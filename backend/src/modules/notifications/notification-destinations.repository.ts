import { Injectable } from '@nestjs/common';
import {
  DevicePlatform,
  NotificationChannel,
  PhoneVerificationPurpose,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DeviceTokenCipher } from './device-token-cipher';
import type { DeviceRegistrationResponse, MessagingDestinationState } from './notification.types';

interface DeviceRow extends DeviceRegistrationResponse {
  token: string;
  endpointId: string;
}

interface MessagingRow extends MessagingDestinationState {
  smsEndpointId: string;
  whatsappEndpointId: string;
}

export interface VerificationRow {
  id: string;
  destinationId: string;
  purpose: PhoneVerificationPurpose;
  codeHash: string;
  attemptCount: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw' | '$executeRaw'> | Prisma.TransactionClient;

@Injectable()
export class NotificationDestinationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceTokenCipher: DeviceTokenCipher,
  ) {}

  async registerDevice(
    userId: string,
    deviceId: string,
    endpointId: string,
    token: string,
    tokenHash: string,
    platform: DevicePlatform,
    appVersion?: string,
  ): Promise<DeviceRegistrationResponse> {
    const rows = await this.prisma.$queryRaw<DeviceRow[]>(Prisma.sql`
      INSERT INTO "notification_endpoints" (
        "id", "user_id", "channel", "destination_hash", "status"
      ) VALUES (
        ${endpointId}::uuid,
        ${userId}::uuid,
        CAST('APP_PUSH' AS "NotificationChannel"),
        ${tokenHash},
        CAST('ACTIVE' AS "NotificationEndpointStatus")
      )
      ON CONFLICT ("user_id", "channel", "destination_hash") DO UPDATE SET
        "status" = CAST('ACTIVE' AS "NotificationEndpointStatus"),
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "id"::text AS "endpointId"
    `);
    const resolvedEndpointId = rows[0]?.endpointId ?? endpointId;
    const registration = await this.prisma.$queryRaw<DeviceRow[]>(Prisma.sql`
      INSERT INTO "device_registrations" (
        "id", "user_id", "endpoint_id", "token_secret", "platform", "app_version",
        "last_seen_at", "revoked_at"
      ) VALUES (
        ${deviceId}::uuid,
        ${userId}::uuid,
        ${resolvedEndpointId}::uuid,
        ${this.deviceTokenCipher.encrypt(token)},
        CAST(${platform} AS "DevicePlatform"),
        ${appVersion ?? null},
        CURRENT_TIMESTAMP,
        NULL
      )
      ON CONFLICT ("endpoint_id") DO UPDATE SET
        "token_secret" = EXCLUDED."token_secret",
        "platform" = EXCLUDED."platform",
        "app_version" = EXCLUDED."app_version",
        "last_seen_at" = CURRENT_TIMESTAMP,
        "revoked_at" = NULL,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING
        "id"::text AS "id",
        "platform" AS "platform",
        "app_version" AS "appVersion",
        "last_seen_at" AS "lastSeenAt",
        "created_at" AS "createdAt"
    `);
    const result = registration[0];
    if (!result) throw new Error('Device registration could not be persisted');
    return result;
  }

  async findDevices(userId: string): Promise<DeviceRow[]> {
    return this.prisma.$queryRaw<DeviceRow[]>(Prisma.sql`
      SELECT
        d."id"::text AS "id",
        d."endpoint_id"::text AS "endpointId",
        d."token_secret" AS "token",
        d."platform" AS "platform",
        d."app_version" AS "appVersion",
        d."last_seen_at" AS "lastSeenAt",
        d."created_at" AS "createdAt"
      FROM "device_registrations" d
      INNER JOIN "notification_endpoints" e ON e."id" = d."endpoint_id"
      WHERE d."user_id" = ${userId}::uuid
        AND d."revoked_at" IS NULL
        AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
      ORDER BY d."last_seen_at" DESC, d."id" DESC
    `);
  }

  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "device_registrations" d
      SET "revoked_at" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE d."id" = ${deviceId}::uuid
        AND d."user_id" = ${userId}::uuid
        AND d."revoked_at" IS NULL
    `);
    if (result > 0) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "notification_endpoints" e
        SET "status" = CAST('REVOKED' AS "NotificationEndpointStatus"),
            "updated_at" = CURRENT_TIMESTAMP
        FROM "device_registrations" d
        WHERE d."endpoint_id" = e."id"
          AND d."id" = ${deviceId}::uuid
      `);
    }
    return result > 0;
  }

  async findMessagingDestination(userId: string): Promise<MessagingRow | null> {
    const rows = await this.prisma.$queryRaw<MessagingRow[]>(Prisma.sql`
      SELECT
        m."id"::text AS "id",
        m."phone_number" AS "phoneNumber",
        m."phone_verified_at" AS "phoneVerifiedAt",
        m."whatsapp_status" AS "whatsappStatus",
        m."whatsapp_verified_at" AS "whatsappVerifiedAt",
        m."sms_endpoint_id"::text AS "smsEndpointId",
        m."whatsapp_endpoint_id"::text AS "whatsappEndpointId"
      FROM "messaging_destinations" m
      WHERE m."user_id" = ${userId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async ensureMessagingDestination(
    userId: string,
    destinationId: string,
    smsEndpointId: string,
    whatsappEndpointId: string,
    phoneNumber: string,
    smsDestinationHash: string,
    whatsappDestinationHash: string,
    purpose: PhoneVerificationPurpose,
  ): Promise<MessagingRow> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.findMessagingWithClient(transaction, userId, true);
      const numberChanged = existing !== null && existing.phoneNumber !== phoneNumber;
      const resolvedSmsEndpointId = await this.upsertMessagingEndpoint(
        transaction,
        userId,
        smsEndpointId,
        NotificationChannel.SMS,
        smsDestinationHash,
      );
      const resolvedWhatsAppEndpointId = await this.upsertMessagingEndpoint(
        transaction,
        userId,
        whatsappEndpointId,
        NotificationChannel.WHATSAPP,
        whatsappDestinationHash,
      );

      if (existing) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "messaging_destinations"
          SET "phone_number" = ${phoneNumber},
              "sms_endpoint_id" = ${resolvedSmsEndpointId}::uuid,
              "whatsapp_endpoint_id" = ${resolvedWhatsAppEndpointId}::uuid,
              "phone_verified_at" = CASE WHEN ${numberChanged} THEN NULL ELSE "phone_verified_at" END,
              "whatsapp_status" = CASE
                WHEN ${purpose === PhoneVerificationPurpose.WHATSAPP} THEN CAST('PENDING' AS "WhatsAppConnectionStatus")
                WHEN ${numberChanged} THEN CAST('REVOKED' AS "WhatsAppConnectionStatus")
                ELSE "whatsapp_status"
              END,
              "whatsapp_verified_at" = CASE
                WHEN ${purpose === PhoneVerificationPurpose.WHATSAPP} OR ${numberChanged} THEN NULL
                ELSE "whatsapp_verified_at"
              END,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${existing.id}::uuid
        `);
        const updated = await this.findMessagingWithClient(transaction, userId, false);
        if (!updated) throw new Error('Messaging destination could not be read after update');
        return updated;
      }

      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "messaging_destinations" (
          "id", "user_id", "sms_endpoint_id", "whatsapp_endpoint_id", "phone_number",
          "whatsapp_status"
        ) VALUES (
          ${destinationId}::uuid,
          ${userId}::uuid,
          ${resolvedSmsEndpointId}::uuid,
          ${resolvedWhatsAppEndpointId}::uuid,
          ${phoneNumber},
          CASE WHEN ${purpose === PhoneVerificationPurpose.WHATSAPP}
            THEN CAST('PENDING' AS "WhatsAppConnectionStatus")
            ELSE CAST('NOT_CONNECTED' AS "WhatsAppConnectionStatus")
          END
        )
      `);
      const created = await this.findMessagingWithClient(transaction, userId, false);
      if (!created) throw new Error('Messaging destination could not be read after creation');
      return created;
    });
  }

  async createVerification(
    id: string,
    userId: string,
    destinationId: string,
    purpose: PhoneVerificationPurpose,
    codeHash: string,
    expiresAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    await this.prisma.$transaction((transaction) =>
      this.createVerificationWithinTransaction(
        transaction,
        id,
        userId,
        destinationId,
        purpose,
        codeHash,
        expiresAt,
        maxAttempts,
      ),
    );
  }

  async createVerificationWithinTransaction(
    client: Prisma.TransactionClient,
    id: string,
    userId: string,
    destinationId: string,
    purpose: PhoneVerificationPurpose,
    codeHash: string,
    expiresAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "phone_verifications" (
        "id", "user_id", "destination_id", "purpose", "code_hash", "expires_at", "max_attempts"
      ) VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${destinationId}::uuid,
        CAST(${purpose} AS "PhoneVerificationPurpose"),
        ${codeHash},
        ${expiresAt},
        ${maxAttempts}
      )
    `);
  }

  async findLatestVerification(
    userId: string,
    purpose: PhoneVerificationPurpose,
    lock = false,
  ): Promise<VerificationRow | null> {
    return this.findLatestVerificationWithClient(this.prisma, userId, purpose, lock);
  }

  async findLatestVerificationForUpdate(
    client: Prisma.TransactionClient,
    userId: string,
    purpose: PhoneVerificationPurpose,
  ): Promise<VerificationRow | null> {
    return this.findLatestVerificationWithClient(client, userId, purpose, true);
  }

  async incrementVerificationAttempt(
    client: Prisma.TransactionClient,
    id: string,
  ): Promise<number> {
    const rows = await client.$queryRaw<Array<{ attemptCount: number }>>(Prisma.sql`
      UPDATE "phone_verifications"
      SET "attempt_count" = "attempt_count" + 1
      WHERE "id" = ${id}::uuid
      RETURNING "attempt_count" AS "attemptCount"
    `);
    return rows[0]?.attemptCount ?? 0;
  }

  async completeVerification(
    client: Prisma.TransactionClient,
    verificationId: string,
    destinationId: string,
    purpose: PhoneVerificationPurpose,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE "phone_verifications"
      SET "consumed_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${verificationId}::uuid
    `);
    if (purpose === PhoneVerificationPurpose.PHONE) {
      await client.$executeRaw(Prisma.sql`
        UPDATE "messaging_destinations"
        SET "phone_verified_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${destinationId}::uuid
      `);
      await client.$executeRaw(Prisma.sql`
        UPDATE "notification_endpoints"
        SET "verified_at" = CURRENT_TIMESTAMP,
            "status" = CAST('ACTIVE' AS "NotificationEndpointStatus"),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (SELECT "sms_endpoint_id" FROM "messaging_destinations" WHERE "id" = ${destinationId}::uuid)
      `);
    } else {
      await client.$executeRaw(Prisma.sql`
        UPDATE "messaging_destinations"
        SET "whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus"),
            "whatsapp_verified_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${destinationId}::uuid
      `);
      await client.$executeRaw(Prisma.sql`
        UPDATE "notification_endpoints"
        SET "verified_at" = CURRENT_TIMESTAMP,
            "status" = CAST('ACTIVE' AS "NotificationEndpointStatus"),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (SELECT "whatsapp_endpoint_id" FROM "messaging_destinations" WHERE "id" = ${destinationId}::uuid)
      `);
    }
  }

  async disconnectWhatsApp(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "messaging_destinations"
      SET "whatsapp_status" = CAST('REVOKED' AS "WhatsAppConnectionStatus"),
          "whatsapp_verified_at" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "user_id" = ${userId}::uuid
        AND "whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus")
      RETURNING "id"::text AS "id"
    `);
    if (!rows[0]) return false;
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "notification_endpoints" e
      SET "status" = CAST('REVOKED' AS "NotificationEndpointStatus"),
          "updated_at" = CURRENT_TIMESTAMP
      FROM "messaging_destinations" m
      WHERE m."whatsapp_endpoint_id" = e."id"
        AND m."id" = ${rows[0].id}::uuid
    `);
    return true;
  }

  private async upsertMessagingEndpoint(
    client: Prisma.TransactionClient,
    userId: string,
    endpointId: string,
    channel: NotificationChannel,
    destinationHash: string,
  ): Promise<string> {
    const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "notification_endpoints" (
        "id", "user_id", "channel", "destination_hash", "status"
      ) VALUES (
        ${endpointId}::uuid,
        ${userId}::uuid,
        CAST(${channel} AS "NotificationChannel"),
        ${destinationHash},
        CAST('ACTIVE' AS "NotificationEndpointStatus")
      )
      ON CONFLICT ("user_id", "channel", "destination_hash") DO UPDATE SET
        "status" = CAST('ACTIVE' AS "NotificationEndpointStatus"),
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "id"::text AS "id"
    `);
    if (rows[0]) return rows[0].id;
    const existing = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"::text AS "id"
      FROM "notification_endpoints"
      WHERE "user_id" = ${userId}::uuid
        AND "channel" = CAST(${channel} AS "NotificationChannel")
        AND "destination_hash" = ${destinationHash}
      LIMIT 1
    `);
    if (!existing[0]) throw new Error('Messaging endpoint could not be persisted');
    return existing[0].id;
  }

  private async findMessagingWithClient(
    client: DatabaseClient,
    userId: string,
    lock: boolean,
  ): Promise<MessagingRow | null> {
    const lockClause = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<MessagingRow[]>(Prisma.sql`
      SELECT
        m."id"::text AS "id",
        m."phone_number" AS "phoneNumber",
        m."phone_verified_at" AS "phoneVerifiedAt",
        m."whatsapp_status" AS "whatsappStatus",
        m."whatsapp_verified_at" AS "whatsappVerifiedAt",
        m."sms_endpoint_id"::text AS "smsEndpointId",
        m."whatsapp_endpoint_id"::text AS "whatsappEndpointId"
      FROM "messaging_destinations" m
      WHERE m."user_id" = ${userId}::uuid
      LIMIT 1
      ${lockClause}
    `);
    return rows[0] ?? null;
  }

  private async findLatestVerificationWithClient(
    client: DatabaseClient,
    userId: string,
    purpose: PhoneVerificationPurpose,
    lock: boolean,
  ): Promise<VerificationRow | null> {
    const lockClause = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<VerificationRow[]>(Prisma.sql`
      SELECT
        v."id"::text AS "id",
        v."destination_id"::text AS "destinationId",
        v."purpose" AS "purpose",
        v."code_hash" AS "codeHash",
        v."attempt_count" AS "attemptCount",
        v."max_attempts" AS "maxAttempts",
        v."expires_at" AS "expiresAt",
        v."consumed_at" AS "consumedAt",
        v."created_at" AS "createdAt"
      FROM "phone_verifications" v
      WHERE v."user_id" = ${userId}::uuid
        AND v."purpose" = CAST(${purpose} AS "PhoneVerificationPurpose")
      ORDER BY v."created_at" DESC
      LIMIT 1
      ${lockClause}
    `);
    return rows[0] ?? null;
  }
}

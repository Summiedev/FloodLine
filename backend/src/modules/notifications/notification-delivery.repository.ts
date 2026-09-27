import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type {
  AlertTarget,
  NotificationDeliveryRecord,
  NotificationRecord,
} from './notification.types';
import { DeviceTokenCipher } from './device-token-cipher';

interface DeliveryRow extends NotificationDeliveryRecord {
  attemptCount: number;
}

export interface PushRecipientRow {
  registrationId: string;
  token: string;
  platform: string;
}

export interface MessagingRouteRow {
  phoneNumber: string;
}

export interface CreatedNotification {
  notification: NotificationRecord;
  deliveryIds: string[];
}

@Injectable()
export class NotificationDeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceTokenCipher: DeviceTokenCipher,
  ) {}

  async createIfAbsent(
    target: AlertTarget,
    triggerKey: string,
    escalationLevel: number,
  ): Promise<CreatedNotification | null> {
    const isIncident = target.sourceType === NotificationType.INCIDENT_ALERT;
    const dedupeKey = `${target.sourceType}:${target.sourceId}:${target.userId}:${triggerKey}`;
    return this.prisma.$transaction(async (transaction) => {
      const higherRows = await transaction.$queryRaw<Array<{ maxEscalation: number | null }>>(
        Prisma.sql`
          SELECT MAX("escalation_level")::integer AS "maxEscalation"
          FROM "notifications"
          WHERE "user_id" = ${target.userId}::uuid
            AND "notification_type" = CAST(${target.sourceType} AS "NotificationType")
            AND ${
              isIncident
                ? Prisma.sql`"incident_id" = ${target.sourceId}::uuid`
                : Prisma.sql`"official_warning_id" = ${target.sourceId}::uuid`
            }
        `,
      );
      if (
        higherRows[0]?.maxEscalation !== null &&
        higherRows[0]?.maxEscalation !== undefined &&
        higherRows[0].maxEscalation > escalationLevel
      ) {
        return null;
      }
      const rows = await transaction.$queryRaw<NotificationRecord[]>(Prisma.sql`
        INSERT INTO "notifications" (
          "user_id", "incident_id", "official_warning_id", "saved_place_id",
          "notification_type", "severity", "dedupe_key", "trigger_key", "escalation_level", "title", "body",
          "template_parameters", "state"
        ) VALUES (
          ${target.userId}::uuid,
          ${isIncident ? target.sourceId : null}::uuid,
          ${isIncident ? null : target.sourceId}::uuid,
          ${target.savedPlaceId}::uuid,
          CAST(${target.sourceType} AS "NotificationType"),
          CAST(${target.severity} AS "IncidentSeverity"),
          ${dedupeKey},
          ${triggerKey},
          ${escalationLevel},
          ${target.title},
          ${target.body},
          ${JSON.stringify({ savedPlaceLabel: target.savedPlaceLabel, distanceMeters: target.distanceMeters })}::jsonb,
          CAST('PENDING' AS "NotificationState")
        )
        ON CONFLICT ("dedupe_key") DO NOTHING
        RETURNING
          "id"::text AS "id",
          "user_id"::text AS "userId",
          "incident_id"::text AS "incidentId",
          "official_warning_id"::text AS "officialWarningId",
          "saved_place_id"::text AS "savedPlaceId",
          "notification_type" AS "notificationType",
          "severity" AS "severity",
          "dedupe_key" AS "dedupeKey",
          "trigger_key" AS "triggerKey",
          "escalation_level" AS "escalationLevel",
          "title" AS "title",
          "body" AS "body",
          "template_parameters" AS "templateParameters",
          "state" AS "state",
          "read_at" AS "readAt"
      `);
      const notification = rows[0];
      if (!notification) return null;

      const deliveryIds: string[] = [];
      for (const channel of target.enabledChannels) {
        const deliveryId = randomUUID();
        const delivery = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          INSERT INTO "notification_deliveries" (
            "id", "notification_id", "channel", "status"
          ) VALUES (
            ${deliveryId}::uuid,
            ${notification.id}::uuid,
            CAST(${channel} AS "NotificationChannel"),
            CAST('PENDING' AS "NotificationDeliveryStatus")
          )
          ON CONFLICT ("notification_id", "channel") DO NOTHING
          RETURNING "id"::text AS "id"
        `);
        if (delivery[0]) deliveryIds.push(delivery[0].id);
      }
      if (deliveryIds.length === 0) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "notifications"
          SET "state" = CAST('SKIPPED' AS "NotificationState"),
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${notification.id}::uuid
        `);
      }
      return { notification, deliveryIds };
    });
  }

  async claimDelivery(deliveryId: string): Promise<DeliveryRow | null> {
    const rows = await this.prisma.$queryRaw<DeliveryRow[]>(Prisma.sql`
      UPDATE "notification_deliveries" d
      SET "status" = CAST('DELIVERING' AS "NotificationDeliveryStatus"),
          "attempt_count" = d."attempt_count" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      FROM "notifications" n
      WHERE d."id" = ${deliveryId}::uuid
        AND d."notification_id" = n."id"
        AND (
          d."status" IN (
            CAST('PENDING' AS "NotificationDeliveryStatus"),
            CAST('FAILED' AS "NotificationDeliveryStatus")
          )
          OR (
            d."status" = CAST('DELIVERING' AS "NotificationDeliveryStatus")
            AND d."updated_at" <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
          )
        )
        AND (d."next_attempt_at" IS NULL OR d."next_attempt_at" <= CURRENT_TIMESTAMP)
      RETURNING
        d."id"::text AS "id",
        d."notification_id"::text AS "notificationId",
        n."user_id"::text AS "userId",
        d."channel" AS "channel",
        d."status" AS "status",
        d."attempt_count" AS "attemptCount",
        d."provider_message_id" AS "providerMessageId",
        n."title" AS "title",
        n."body" AS "body",
        n."incident_id"::text AS "incidentId",
        n."official_warning_id"::text AS "officialWarningId"
    `);
    return rows[0] ?? null;
  }

  async findPushRecipients(userId: string): Promise<PushRecipientRow[]> {
    const rows = await this.prisma.$queryRaw<PushRecipientRow[]>(Prisma.sql`
      SELECT
        d."id"::text AS "registrationId",
        d."token_secret" AS "token",
        d."platform"::text AS "platform"
      FROM "device_registrations" d
      INNER JOIN "notification_endpoints" e ON e."id" = d."endpoint_id"
      WHERE d."user_id" = ${userId}::uuid
        AND d."revoked_at" IS NULL
        AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
    `);
    return rows.flatMap((row) => {
      try {
        return [{ ...row, token: this.deviceTokenCipher.decrypt(row.token) }];
      } catch {
        return [];
      }
    });
  }

  async findMessagingRoute(
    userId: string,
    channel: NotificationChannel,
  ): Promise<MessagingRouteRow | null> {
    const endpointColumn =
      channel === NotificationChannel.SMS
        ? Prisma.sql`m."sms_endpoint_id"`
        : Prisma.sql`m."whatsapp_endpoint_id"`;
    const capability =
      channel === NotificationChannel.SMS
        ? Prisma.sql`m."phone_verified_at" IS NOT NULL`
        : Prisma.sql`m."whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus")`;
    const rows = await this.prisma.$queryRaw<MessagingRouteRow[]>(Prisma.sql`
      SELECT m."phone_number" AS "phoneNumber"
      FROM "messaging_destinations" m
      INNER JOIN "notification_endpoints" e ON e."id" = ${endpointColumn}
      WHERE m."user_id" = ${userId}::uuid
        AND ${capability}
        AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async markSent(deliveryId: string, providerMessageId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ notificationId: string }>>(Prisma.sql`
        UPDATE "notification_deliveries"
        SET "status" = CAST('SENT' AS "NotificationDeliveryStatus"),
            "provider_message_id" = ${providerMessageId},
            "sent_at" = CURRENT_TIMESTAMP,
            "next_attempt_at" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${deliveryId}::uuid
        RETURNING "notification_id"::text AS "notificationId"
      `);
      const notificationId = rows[0]?.notificationId;
      if (!notificationId) return;
      await this.updateNotificationState(transaction, notificationId);
    });
  }

  async markFailed(
    deliveryId: string,
    errorMessage: string,
    deadLetter: boolean,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ notificationId: string }>>(Prisma.sql`
        UPDATE "notification_deliveries"
        SET "status" = CAST(${deadLetter ? 'DEAD_LETTER' : 'FAILED'} AS "NotificationDeliveryStatus"),
            "last_error" = ${errorMessage.slice(0, 2_000)},
            "next_attempt_at" = ${deadLetter ? null : nextAttemptAt},
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${deliveryId}::uuid
        RETURNING "notification_id"::text AS "notificationId"
      `);
      const notificationId = rows[0]?.notificationId;
      if (!notificationId) return;
      await this.updateNotificationState(transaction, notificationId);
    });
  }

  async markSkipped(deliveryId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ notificationId: string }>>(Prisma.sql`
        UPDATE "notification_deliveries"
        SET "status" = CAST('SKIPPED' AS "NotificationDeliveryStatus"),
            "last_error" = ${reason.slice(0, 2_000)},
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${deliveryId}::uuid
        RETURNING "notification_id"::text AS "notificationId"
      `);
      const notificationId = rows[0]?.notificationId;
      if (notificationId) await this.updateNotificationState(transaction, notificationId);
    });
  }

  private async updateNotificationState(
    transaction: Prisma.TransactionClient,
    notificationId: string,
  ): Promise<void> {
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "notifications" n
      SET "state" = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM "notification_deliveries" d
          WHERE d."notification_id" = n."id"
            AND d."status" NOT IN (
              CAST('SENT' AS "NotificationDeliveryStatus"),
              CAST('SKIPPED' AS "NotificationDeliveryStatus")
            )
        ) THEN CAST('SENT' AS "NotificationState")
        WHEN EXISTS (
          SELECT 1 FROM "notification_deliveries" d
          WHERE d."notification_id" = n."id"
            AND d."status" = CAST('SENT' AS "NotificationDeliveryStatus")
        ) THEN CAST('PARTIAL' AS "NotificationState")
        WHEN EXISTS (
          SELECT 1 FROM "notification_deliveries" d
          WHERE d."notification_id" = n."id"
            AND d."status" = CAST('DEAD_LETTER' AS "NotificationDeliveryStatus")
        ) THEN CAST('FAILED' AS "NotificationState")
        ELSE CAST('DELIVERING' AS "NotificationState")
      END,
      "updated_at" = CURRENT_TIMESTAMP
      WHERE n."id" = ${notificationId}::uuid
    `);
  }
}

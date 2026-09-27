import { Injectable } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { NotificationPreferenceResponse } from './notification.types';

interface PreferenceRow {
  channel: NotificationChannel;
  enabled: boolean;
}

interface AvailabilityRow {
  hasPushDevice: boolean;
  hasVerifiedPhone: boolean;
  hasVerifiedWhatsApp: boolean;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw' | '$executeRaw'> | Prisma.TransactionClient;

@Injectable()
export class NotificationPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(userId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "notification_preferences" ("user_id", "channel")
      VALUES
        (${userId}::uuid, CAST('APP_PUSH' AS "NotificationChannel")),
        (${userId}::uuid, CAST('SMS' AS "NotificationChannel")),
        (${userId}::uuid, CAST('WHATSAPP' AS "NotificationChannel"))
      ON CONFLICT ("user_id", "channel") DO NOTHING
    `);
  }

  async find(userId: string): Promise<PreferenceRow[]> {
    return this.prisma.$queryRaw<PreferenceRow[]>(Prisma.sql`
      SELECT "channel", "enabled"
      FROM "notification_preferences"
      WHERE "user_id" = ${userId}::uuid
      ORDER BY "channel"
    `);
  }

  async getAvailability(userId: string): Promise<AvailabilityRow> {
    const rows = await this.prisma.$queryRaw<AvailabilityRow[]>(Prisma.sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM "device_registrations" d
          INNER JOIN "notification_endpoints" e ON e."id" = d."endpoint_id"
          WHERE d."user_id" = ${userId}::uuid
            AND d."revoked_at" IS NULL
            AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
        ) AS "hasPushDevice",
        EXISTS (
          SELECT 1
          FROM "messaging_destinations" m
          INNER JOIN "notification_endpoints" e ON e."id" = m."sms_endpoint_id"
          WHERE m."user_id" = ${userId}::uuid
            AND m."phone_verified_at" IS NOT NULL
            AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
        ) AS "hasVerifiedPhone",
        EXISTS (
          SELECT 1
          FROM "messaging_destinations" m
          INNER JOIN "notification_endpoints" e ON e."id" = m."whatsapp_endpoint_id"
          WHERE m."user_id" = ${userId}::uuid
            AND m."whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus")
            AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
        ) AS "hasVerifiedWhatsApp"
    `);
    return (
      rows[0] ?? {
        hasPushDevice: false,
        hasVerifiedPhone: false,
        hasVerifiedWhatsApp: false,
      }
    );
  }

  async update(
    userId: string,
    updates: Partial<Record<NotificationChannel, boolean>>,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.ensureDefaultsWithClient(transaction, userId);
      for (const [channel, enabled] of Object.entries(updates) as Array<
        [NotificationChannel, boolean]
      >) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "notification_preferences"
          SET "enabled" = ${enabled}, "updated_at" = CURRENT_TIMESTAMP
          WHERE "user_id" = ${userId}::uuid
            AND "channel" = CAST(${channel} AS "NotificationChannel")
        `);
      }
    });
  }

  private async ensureDefaultsWithClient(client: DatabaseClient, userId: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "notification_preferences" ("user_id", "channel")
      VALUES
        (${userId}::uuid, CAST('APP_PUSH' AS "NotificationChannel")),
        (${userId}::uuid, CAST('SMS' AS "NotificationChannel")),
        (${userId}::uuid, CAST('WHATSAPP' AS "NotificationChannel"))
      ON CONFLICT ("user_id", "channel") DO NOTHING
    `);
  }

  toResponse(
    rows: PreferenceRow[],
    availability: AvailabilityRow,
  ): NotificationPreferenceResponse[] {
    const enabledByChannel = new Map(rows.map((row) => [row.channel, row.enabled]));
    const availableByChannel: Record<NotificationChannel, boolean> = {
      APP_PUSH: availability.hasPushDevice,
      SMS: availability.hasVerifiedPhone,
      WHATSAPP: availability.hasVerifiedWhatsApp,
    };
    const reasonByChannel: Record<NotificationChannel, string> = {
      APP_PUSH: 'Register at least one active device',
      SMS: 'Verify a phone number',
      WHATSAPP: 'Complete WhatsApp connection verification',
    };
    return Object.values(NotificationChannel).map((channel) => ({
      channel,
      enabled: enabledByChannel.get(channel) ?? false,
      available: availableByChannel[channel],
      ...(availableByChannel[channel] ? {} : { reason: reasonByChannel[channel] }),
    }));
  }
}

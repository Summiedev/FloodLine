import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AlertTarget } from './notification.types';

interface AlertTargetRow {
  userId: string;
  savedPlaceId: string;
  savedPlaceLabel: string;
  distanceMeters: number;
  enabledChannels: NotificationChannel[];
  sourceId: string;
  sourceType: NotificationType;
  incidentType: string;
  severity: string;
  title: string;
  body: string;
}

@Injectable()
export class AlertEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findIncidentTargets(
    incidentId: string,
    defaultRadiusMeters: number,
    batchSize: number,
    afterUserId?: string,
  ): Promise<AlertTarget[]> {
    const rows = await this.prisma.$queryRaw<AlertTargetRow[]>(Prisma.sql`
      WITH candidate_targets AS (
        SELECT DISTINCT ON (sp."user_id")
          sp."user_id"::text AS "userId",
          sp."id"::text AS "savedPlaceId",
          COALESCE(NULLIF(sp."custom_label", ''), sp."formatted_address") AS "savedPlaceLabel",
          LEAST(
            ST_Distance(sp."location", i."location"),
            CASE
              WHEN i."affected_geometry" IS NULL THEN 1e30::double precision
              ELSE ST_Distance(sp."location", i."affected_geometry"::geography)
            END
          )::double precision AS "distanceMeters",
          ARRAY_REMOVE(ARRAY[
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              WHERE np."user_id" = sp."user_id"
                AND np."channel" = CAST('APP_PUSH' AS "NotificationChannel")
                AND np."enabled" = TRUE
                AND EXISTS (
                  SELECT 1 FROM "device_registrations" d
                  INNER JOIN "notification_endpoints" e ON e."id" = d."endpoint_id"
                  WHERE d."user_id" = sp."user_id"
                    AND d."revoked_at" IS NULL
                    AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
                )
            ) THEN CAST('APP_PUSH' AS "NotificationChannel") END,
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              INNER JOIN "messaging_destinations" md ON md."user_id" = np."user_id"
              INNER JOIN "notification_endpoints" e ON e."id" = md."sms_endpoint_id"
              WHERE np."user_id" = sp."user_id"
                AND np."channel" = CAST('SMS' AS "NotificationChannel")
                AND np."enabled" = TRUE
                AND md."phone_verified_at" IS NOT NULL
                AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
            ) THEN CAST('SMS' AS "NotificationChannel") END,
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              INNER JOIN "messaging_destinations" md ON md."user_id" = np."user_id"
              INNER JOIN "notification_endpoints" e ON e."id" = md."whatsapp_endpoint_id"
              WHERE np."user_id" = sp."user_id"
                AND np."channel" = CAST('WHATSAPP' AS "NotificationChannel")
                AND np."enabled" = TRUE
                AND md."whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus")
                AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
            ) THEN CAST('WHATSAPP' AS "NotificationChannel") END
          ], NULL::"NotificationChannel") AS "enabledChannels",
          i."id"::text AS "sourceId",
          CAST('INCIDENT_ALERT' AS "NotificationType") AS "sourceType",
          i."incident_type"::text AS "incidentType",
          i."severity"::text AS "severity",
          CONCAT('Flooding alert near ', COALESCE(NULLIF(sp."custom_label", ''), sp."formatted_address")) AS "title",
          LEFT(i."description", 2_000) AS "body"
        FROM "saved_places" sp
        INNER JOIN "incidents" i ON i."id" = ${incidentId}::uuid
        LEFT JOIN LATERAL (
          SELECT ap."radius_meters", ap."incident_types"
          FROM "alert_preferences" ap
          WHERE ap."user_id" = sp."user_id"
            AND (ap."saved_place_id" = sp."id" OR ap."saved_place_id" IS NULL)
          ORDER BY CASE WHEN ap."saved_place_id" = sp."id" THEN 0 ELSE 1 END
          LIMIT 1
        ) pref ON TRUE
        WHERE sp."is_active" = TRUE
          AND i."status" = CAST('ACTIVE' AS "IncidentStatus")
          AND (i."expires_at" IS NULL OR i."expires_at" > CURRENT_TIMESTAMP)
          AND i."incident_type" = ANY(COALESCE(
            pref."incident_types",
            ARRAY[
              CAST('SEVERE_FLOODING' AS "IncidentType"),
              CAST('MODERATE_FLOODING' AS "IncidentType"),
              CAST('BLOCKED_ROAD' AS "IncidentType"),
              CAST('BLOCKED_DRAIN' AS "IncidentType")
            ]::"IncidentType"[]
          ))
          AND (
            ST_DWithin(sp."location", i."location", COALESCE(pref."radius_meters", ${defaultRadiusMeters}))
            OR (
              i."affected_geometry" IS NOT NULL
              AND ST_DWithin(sp."location", i."affected_geometry"::geography, COALESCE(pref."radius_meters", ${defaultRadiusMeters}))
            )
          )
          ${afterUserId ? Prisma.sql`AND sp."user_id" > ${afterUserId}::uuid` : Prisma.empty}
        ORDER BY sp."user_id", "distanceMeters" ASC, sp."id"
      )
      SELECT *
      FROM candidate_targets
      WHERE CARDINALITY("enabledChannels") > 0
      ORDER BY "userId"
      LIMIT ${batchSize}
    `);
    return rows;
  }

  async findOfficialWarningTargets(
    warningId: string,
    defaultRadiusMeters: number,
    batchSize: number,
    afterUserId?: string,
  ): Promise<AlertTarget[]> {
    const rows = await this.prisma.$queryRaw<AlertTargetRow[]>(Prisma.sql`
      WITH candidate_targets AS (
        SELECT DISTINCT ON (sp."user_id")
          sp."user_id"::text AS "userId",
          sp."id"::text AS "savedPlaceId",
          COALESCE(NULLIF(sp."custom_label", ''), sp."formatted_address") AS "savedPlaceLabel",
          ST_Distance(sp."location", w."affected_geometry"::geography)::double precision AS "distanceMeters",
          ARRAY_REMOVE(ARRAY[
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              WHERE np."user_id" = sp."user_id"
                AND np."channel" = CAST('APP_PUSH' AS "NotificationChannel")
                AND np."enabled" = TRUE
                AND EXISTS (
                  SELECT 1 FROM "device_registrations" d
                  INNER JOIN "notification_endpoints" e ON e."id" = d."endpoint_id"
                  WHERE d."user_id" = sp."user_id" AND d."revoked_at" IS NULL
                    AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
                )
            ) THEN CAST('APP_PUSH' AS "NotificationChannel") END,
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              INNER JOIN "messaging_destinations" md ON md."user_id" = np."user_id"
              INNER JOIN "notification_endpoints" e ON e."id" = md."sms_endpoint_id"
              WHERE np."user_id" = sp."user_id" AND np."channel" = CAST('SMS' AS "NotificationChannel")
                AND np."enabled" = TRUE AND md."phone_verified_at" IS NOT NULL
                AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
            ) THEN CAST('SMS' AS "NotificationChannel") END,
            CASE WHEN EXISTS (
              SELECT 1 FROM "notification_preferences" np
              INNER JOIN "messaging_destinations" md ON md."user_id" = np."user_id"
              INNER JOIN "notification_endpoints" e ON e."id" = md."whatsapp_endpoint_id"
              WHERE np."user_id" = sp."user_id" AND np."channel" = CAST('WHATSAPP' AS "NotificationChannel")
                AND np."enabled" = TRUE AND md."whatsapp_status" = CAST('VERIFIED' AS "WhatsAppConnectionStatus")
                AND e."status" = CAST('ACTIVE' AS "NotificationEndpointStatus")
            ) THEN CAST('WHATSAPP' AS "NotificationChannel") END
          ], NULL::"NotificationChannel") AS "enabledChannels",
          w."id"::text AS "sourceId",
          CAST('OFFICIAL_WARNING' AS "NotificationType") AS "sourceType",
          CASE WHEN w."severity" = CAST('SEVERE' AS "IncidentSeverity")
            THEN 'SEVERE_FLOODING' ELSE 'MODERATE_FLOODING' END AS "incidentType",
          w."severity"::text AS "severity",
          w."title" AS "title",
          LEFT(w."description", 2_000) AS "body"
        FROM "saved_places" sp
        INNER JOIN "official_warnings" w ON w."id" = ${warningId}::uuid
        LEFT JOIN LATERAL (
          SELECT ap."radius_meters", ap."incident_types"
          FROM "alert_preferences" ap
          WHERE ap."user_id" = sp."user_id"
            AND (ap."saved_place_id" = sp."id" OR ap."saved_place_id" IS NULL)
          ORDER BY CASE WHEN ap."saved_place_id" = sp."id" THEN 0 ELSE 1 END
          LIMIT 1
        ) pref ON TRUE
        WHERE sp."is_active" = TRUE
          AND w."status" = CAST('ACTIVE' AS "OfficialWarningStatus")
          AND w."effective_at" <= CURRENT_TIMESTAMP
          AND (w."expires_at" IS NULL OR w."expires_at" > CURRENT_TIMESTAMP)
          AND (
            CASE WHEN w."severity" = CAST('SEVERE' AS "IncidentSeverity")
              THEN CAST('SEVERE_FLOODING' AS "IncidentType")
              ELSE CAST('MODERATE_FLOODING' AS "IncidentType")
            END
          ) = ANY(COALESCE(
            pref."incident_types",
            ARRAY[
              CAST('SEVERE_FLOODING' AS "IncidentType"),
              CAST('MODERATE_FLOODING' AS "IncidentType"),
              CAST('BLOCKED_ROAD' AS "IncidentType"),
              CAST('BLOCKED_DRAIN' AS "IncidentType")
            ]::"IncidentType"[]
          ))
          AND ST_DWithin(
            sp."location",
            w."affected_geometry"::geography,
            COALESCE(pref."radius_meters", ${defaultRadiusMeters})
          )
          ${afterUserId ? Prisma.sql`AND sp."user_id" > ${afterUserId}::uuid` : Prisma.empty}
        ORDER BY sp."user_id", "distanceMeters" ASC, sp."id"
      )
      SELECT *
      FROM candidate_targets
      WHERE CARDINALITY("enabledChannels") > 0
      ORDER BY "userId"
      LIMIT ${batchSize}
    `);
    return rows;
  }
}

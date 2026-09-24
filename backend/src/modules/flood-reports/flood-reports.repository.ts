import { Injectable } from '@nestjs/common';
import { IncidentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { FloodReportCreateRecord } from './flood-report.types';

@Injectable()
export class FloodReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireSubmissionLock(
    transaction: Prisma.TransactionClient,
    reporterUserId: string,
  ): Promise<void> {
    await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`flood-report:user:${reporterUserId}`}, 0))
    `);
  }

  async acquireAssociationLock(
    transaction: Prisma.TransactionClient,
    reportType: IncidentType,
    longitude: number,
    latitude: number,
  ): Promise<void> {
    const lockKey = `flood-report:association:${reportType}:${Math.round(longitude * 100)}:${Math.round(latitude * 100)}`;
    await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `);
  }

  async findRecentDuplicate(
    transaction: Prisma.TransactionClient,
    record: Pick<
      FloodReportCreateRecord,
      'reporterUserId' | 'reportType' | 'longitude' | 'latitude'
    >,
    windowSeconds: number,
    radiusMeters: number,
  ): Promise<string | null> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT fr.id::text AS id
      FROM "flood_reports" fr
      WHERE fr.reporter_user_id = ${record.reporterUserId}::uuid
        AND fr.report_type = CAST(${record.reportType} AS "IncidentType")
        AND fr.created_at >= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
        AND ST_DWithin(
          fr.location,
          ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY fr.created_at DESC
      LIMIT 1
    `);
    return rows[0]?.id ?? null;
  }

  async findCompatibleIncident(
    transaction: Prisma.TransactionClient,
    reportType: IncidentType,
    longitude: number,
    latitude: number,
    lookbackMinutes: number,
    radiusMeters: number,
  ): Promise<string | null> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT i.id::text AS id
      FROM "incidents" i
      WHERE i.status = CAST('ACTIVE' AS "IncidentStatus")
        AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
        AND i.incident_type = CAST(${reportType} AS "IncidentType")
        AND i.updated_at >= CURRENT_TIMESTAMP - (${lookbackMinutes} * INTERVAL '1 minute')
        AND ST_DWithin(
          i.location,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY ST_Distance(
        i.location,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) ASC, i.updated_at DESC, i.id DESC
      LIMIT 1
    `);
    return rows[0]?.id ?? null;
  }

  async touchIncident(transaction: Prisma.TransactionClient, incidentId: string): Promise<void> {
    await transaction.$queryRaw(Prisma.sql`
      UPDATE "incidents"
      SET "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${incidentId}::uuid
    `);
  }

  async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    record: FloodReportCreateRecord,
  ): Promise<void> {
    const occurredAt = record.occurredAt
      ? Prisma.sql`${record.occurredAt}`
      : Prisma.sql`CURRENT_TIMESTAMP`;
    const waterLevelCategory = record.waterLevelCategory
      ? Prisma.sql`CAST(${record.waterLevelCategory} AS "FloodReportWaterLevelCategory")`
      : Prisma.sql`NULL::"FloodReportWaterLevelCategory"`;

    await transaction.$queryRaw(Prisma.sql`
      INSERT INTO "flood_reports" (
        "id", "reporter_user_id", "incident_id", "report_type", "location",
        "location_name", "description", "observed_severity", "water_level_category",
        "occurred_at", "moderation_status", "source_metadata"
      ) VALUES (
        ${record.id}::uuid,
        ${record.reporterUserId}::uuid,
        ${record.incidentId}::uuid,
        CAST(${record.reportType} AS "IncidentType"),
        ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography,
        ${record.locationName},
        ${record.description},
        CAST(${record.observedSeverity} AS "IncidentSeverity"),
        ${waterLevelCategory},
        ${occurredAt},
        CAST('PENDING' AS "FloodReportModerationStatus"),
        CAST(${JSON.stringify(record.sourceMetadata)} AS jsonb)
      )
    `);
  }
}

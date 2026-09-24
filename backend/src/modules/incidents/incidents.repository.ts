import { Injectable } from '@nestjs/common';
import { IncidentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ConfidenceValue, IncidentFilters, RawIncidentRow } from './incident.types';

export interface IncidentCreateRecord {
  id: string;
  incidentType: string;
  severity: string;
  status: string;
  longitude: number;
  latitude: number;
  locationName: string;
  description: string;
  confidence: ConfidenceValue;
  sourceType: string;
  firstReportedAt: Date;
  expiresAt: Date | null;
}

interface IncidentUpdateRecord {
  incidentType?: string;
  severity?: string;
  status?: string;
  longitude?: number;
  latitude?: number;
  locationName?: string;
  description?: string;
  expiresAt?: Date | null;
  resolvedAt?: Date | null;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw'> | Prisma.TransactionClient;

interface CountRow {
  count: bigint;
}

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filters: IncidentFilters): Promise<{ rows: RawIncidentRow[]; total: number }> {
    const clauses = this.buildFilters(filters);
    const where = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
    const distanceExpression = filters.center
      ? Prisma.sql`ST_Distance(i.location, ${this.centerPoint(filters.center.longitude, filters.center.latitude)})::double precision`
      : Prisma.sql`NULL::double precision`;
    const orderBy = filters.center
      ? Prisma.sql`${distanceExpression} ASC, i.updated_at DESC, i.id DESC`
      : Prisma.sql`i.updated_at DESC, i.id DESC`;

    const countQuery = this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "incidents" i
      ${where}
    `);
    const rowsQuery = this.prisma.$queryRaw<RawIncidentRow[]>(Prisma.sql`
      SELECT ${this.selectColumns(distanceExpression)}
      FROM "incidents" i
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${filters.pageSize}
      OFFSET ${(filters.page - 1) * filters.pageSize}
    `);
    const [countRows, rows] = await this.prisma.$transaction([countQuery, rowsQuery]);

    return { rows, total: Number(countRows[0]?.count ?? 0n) };
  }

  async findById(id: string): Promise<RawIncidentRow | null> {
    return this.findByIdWithClient(this.prisma, id);
  }

  async create(record: IncidentCreateRecord): Promise<RawIncidentRow> {
    return this.prisma.$transaction((transaction) =>
      this.createWithinTransaction(transaction, record),
    );
  }

  async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    record: IncidentCreateRecord,
  ): Promise<RawIncidentRow> {
    await transaction.$queryRaw(Prisma.sql`
        INSERT INTO "incidents" (
          "id", "incident_type", "severity", "status", "location",
          "location_name", "description", "confidence_score", "confidence_label",
          "source_type", "first_reported_at", "expires_at"
        ) VALUES (
          ${record.id}::uuid,
          CAST(${record.incidentType} AS "IncidentType"),
          CAST(${record.severity} AS "IncidentSeverity"),
          CAST(${record.status} AS "IncidentStatus"),
          ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography,
          ${record.locationName},
          ${record.description},
          ${record.confidence.score},
          CAST(${record.confidence.label} AS "IncidentConfidenceLabel"),
          CAST(${record.sourceType} AS "IncidentSourceType"),
          ${record.firstReportedAt},
          ${record.expiresAt}
        )
      `);

    const incident = await this.findByIdWithClient(transaction, record.id);
    if (!incident) {
      throw new Error('Incident was created but could not be read back');
    }
    return incident;
  }

  async findByIdWithinTransaction(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<RawIncidentRow | null> {
    return this.findByIdWithClient(transaction, id);
  }

  async update(id: string, record: IncidentUpdateRecord): Promise<RawIncidentRow | null> {
    const assignments: Prisma.Sql[] = [];

    if (record.incidentType !== undefined) {
      assignments.push(
        Prisma.sql`"incident_type" = CAST(${record.incidentType} AS "IncidentType")`,
      );
    }
    if (record.severity !== undefined) {
      assignments.push(Prisma.sql`"severity" = CAST(${record.severity} AS "IncidentSeverity")`);
    }
    if (record.status !== undefined) {
      assignments.push(Prisma.sql`"status" = CAST(${record.status} AS "IncidentStatus")`);
    }
    if (record.longitude !== undefined && record.latitude !== undefined) {
      assignments.push(
        Prisma.sql`"location" = ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography`,
      );
    }
    if (record.locationName !== undefined) {
      assignments.push(Prisma.sql`"location_name" = ${record.locationName}`);
    }
    if (record.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${record.description}`);
    }
    if (record.expiresAt !== undefined) {
      assignments.push(Prisma.sql`"expires_at" = ${record.expiresAt}`);
    }
    if (record.resolvedAt !== undefined) {
      assignments.push(Prisma.sql`"resolved_at" = ${record.resolvedAt}`);
    }

    if (assignments.length === 0) {
      return this.findById(id);
    }

    assignments.push(Prisma.sql`"updated_at" = CURRENT_TIMESTAMP`);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "incidents"
        SET ${Prisma.join(assignments, ', ')}
        WHERE "id" = ${id}::uuid
        RETURNING "id"::text AS id
      `);

      if (!updated[0]) {
        return null;
      }

      return this.findByIdWithClient(transaction, updated[0].id);
    });
  }

  private async findByIdWithClient(
    client: DatabaseClient,
    id: string,
  ): Promise<RawIncidentRow | null> {
    const rows = await client.$queryRaw<RawIncidentRow[]>(Prisma.sql`
      SELECT ${this.selectColumns(Prisma.sql`NULL::double precision`)}
      FROM "incidents" i
      WHERE i."id" = ${id}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private buildFilters(filters: IncidentFilters): Prisma.Sql[] {
    const clauses: Prisma.Sql[] = [this.statusFilter(filters.status ?? IncidentStatus.ACTIVE)];

    if (filters.bbox) {
      clauses.push(Prisma.sql`
        ST_Intersects(
          i.location::geometry,
          ST_MakeEnvelope(
            ${filters.bbox.west},
            ${filters.bbox.south},
            ${filters.bbox.east},
            ${filters.bbox.north},
            4326
          )
        )
      `);
    }

    if (filters.center) {
      clauses.push(
        Prisma.sql`ST_DWithin(
          i.location,
          ${this.centerPoint(filters.center.longitude, filters.center.latitude)},
          ${filters.center.radiusMeters}
        )`,
      );
    }

    if (filters.incidentType) {
      clauses.push(Prisma.sql`i.incident_type = CAST(${filters.incidentType} AS "IncidentType")`);
    }
    if (filters.severity) {
      clauses.push(Prisma.sql`i.severity = CAST(${filters.severity} AS "IncidentSeverity")`);
    }
    if (filters.updatedSince) {
      clauses.push(Prisma.sql`i.updated_at >= ${filters.updatedSince}`);
    }

    return clauses;
  }

  private statusFilter(status: IncidentStatus): Prisma.Sql {
    const active = Prisma.sql`CAST(${IncidentStatus.ACTIVE} AS "IncidentStatus")`;
    const expired = Prisma.sql`CAST(${IncidentStatus.EXPIRED} AS "IncidentStatus")`;

    if (status === IncidentStatus.ACTIVE) {
      return Prisma.sql`
        i.status = ${active}
        AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
      `;
    }

    if (status === IncidentStatus.EXPIRED) {
      return Prisma.sql`
        (
          i.status = ${expired}
          OR (i.status = ${active} AND i.expires_at IS NOT NULL AND i.expires_at <= CURRENT_TIMESTAMP)
        )
      `;
    }

    return Prisma.sql`i.status = CAST(${status} AS "IncidentStatus")`;
  }

  private centerPoint(longitude: number, latitude: number): Prisma.Sql {
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
  }

  private selectColumns(distanceExpression: Prisma.Sql): Prisma.Sql {
    const effectiveStatus = Prisma.sql`
      CASE
        WHEN i.status = CAST(${IncidentStatus.ACTIVE} AS "IncidentStatus")
          AND i.expires_at IS NOT NULL
          AND i.expires_at <= CURRENT_TIMESTAMP
        THEN CAST(${IncidentStatus.EXPIRED} AS "IncidentStatus")
        ELSE i.status
      END
    `;

    return Prisma.sql`
      i.id::text AS "id",
      i.incident_type AS "incidentType",
      i.severity AS "severity",
      ${effectiveStatus} AS "status",
      ST_X(i.location::geometry)::double precision AS "longitude",
      ST_Y(i.location::geometry)::double precision AS "latitude",
      ST_AsGeoJSON(i.affected_geometry) AS "affectedGeometry",
      i.location_name AS "locationName",
      i.description AS "description",
      i.confidence_score::double precision AS "confidenceScore",
      i.confidence_label AS "confidenceLabel",
      i.source_type AS "sourceType",
      i.confirmation_count AS "confirmationCount",
      i.photo_count AS "photoCount",
      i.first_reported_at AS "firstReportedAt",
      i.last_confirmed_at AS "lastConfirmedAt",
      i.resolved_at AS "resolvedAt",
      i.expires_at AS "expiresAt",
      i.created_at AS "createdAt",
      i.updated_at AS "updatedAt",
      ${distanceExpression} AS "distanceMeters"
    `;
  }
}

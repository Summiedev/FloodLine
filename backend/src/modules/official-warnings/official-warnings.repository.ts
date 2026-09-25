import { Injectable } from '@nestjs/common';
import { OfficialWarningStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  OfficialWarningFilters,
  OfficialWarningGeometry,
  OfficialWarningRecord,
  OfficialWarningUpsertInput,
} from './official-warning.types';

interface OfficialWarningRow {
  id: string;
  authority: string;
  externalId: string;
  title: string;
  description: string;
  severity: OfficialWarningRecord['severity'];
  status: OfficialWarningStatus;
  affectedGeometry: string;
  issuedAt: Date;
  effectiveAt: Date;
  expiresAt: Date | null;
  sourceUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertIdentityRow {
  id: string;
  inserted: boolean;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw' | '$executeRaw'> | Prisma.TransactionClient;

@Injectable()
export class OfficialWarningsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    filters: OfficialWarningFilters,
  ): Promise<{ rows: OfficialWarningRecord[]; total: number }> {
    const clauses = this.buildFilters(filters);
    const where = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
    const countQuery = this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "official_warnings" w
      ${where}
    `);
    const rowsQuery = this.prisma.$queryRaw<OfficialWarningRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "official_warnings" w
      ${where}
      ORDER BY w."effective_at" DESC, w."updated_at" DESC, w."id" DESC
      LIMIT ${filters.pageSize}
      OFFSET ${(filters.page - 1) * filters.pageSize}
    `);
    const [countRows, rows] = await this.prisma.$transaction([countQuery, rowsQuery]);

    return {
      rows: rows.map((row) => this.toRecord(row)),
      total: Number(countRows[0]?.count ?? 0n),
    };
  }

  async findById(id: string): Promise<OfficialWarningRecord | null> {
    return this.findByIdWithClient(this.prisma, id);
  }

  async findByIdentity(
    client: DatabaseClient,
    authority: string,
    externalId: string,
    lock = false,
  ): Promise<OfficialWarningRecord | null> {
    const lockClause = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<OfficialWarningRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "official_warnings" w
      WHERE w."authority" = ${authority}
        AND w."external_id" = ${externalId}
      LIMIT 1
      ${lockClause}
    `);
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  async upsertWithinTransaction(
    transaction: Prisma.TransactionClient,
    input: OfficialWarningUpsertInput,
  ): Promise<{ record: OfficialWarningRecord; inserted: boolean }> {
    const geometryJson = JSON.stringify(input.affectedGeometry);
    const rows = await transaction.$queryRaw<UpsertIdentityRow[]>(Prisma.sql`
      INSERT INTO "official_warnings" (
        "authority", "external_id", "title", "description", "severity", "status",
        "affected_geometry", "issued_at", "effective_at", "expires_at", "source_url",
        "raw_provider_metadata"
      ) VALUES (
        ${input.authority},
        ${input.externalId},
        ${input.title},
        ${input.description},
        CAST(${input.severity} AS "IncidentSeverity"),
        CAST(${input.status} AS "OfficialWarningStatus"),
        ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
        ${input.issuedAt},
        ${input.effectiveAt},
        ${input.expiresAt ?? null},
        ${input.sourceUrl ?? null},
        ${input.rawProviderMetadata ? JSON.stringify(input.rawProviderMetadata) : null}::jsonb
      )
      ON CONFLICT ("authority", "external_id") DO UPDATE SET
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "severity" = EXCLUDED."severity",
        "status" = EXCLUDED."status",
        "affected_geometry" = EXCLUDED."affected_geometry",
        "issued_at" = EXCLUDED."issued_at",
        "effective_at" = EXCLUDED."effective_at",
        "expires_at" = EXCLUDED."expires_at",
        "source_url" = EXCLUDED."source_url",
        "raw_provider_metadata" = EXCLUDED."raw_provider_metadata",
        "updated_at" = CASE
          WHEN "official_warnings"."title" IS DISTINCT FROM EXCLUDED."title"
            OR "official_warnings"."description" IS DISTINCT FROM EXCLUDED."description"
            OR "official_warnings"."severity" IS DISTINCT FROM EXCLUDED."severity"
            OR "official_warnings"."status" IS DISTINCT FROM EXCLUDED."status"
            OR "official_warnings"."affected_geometry" IS DISTINCT FROM EXCLUDED."affected_geometry"
            OR "official_warnings"."issued_at" IS DISTINCT FROM EXCLUDED."issued_at"
            OR "official_warnings"."effective_at" IS DISTINCT FROM EXCLUDED."effective_at"
            OR "official_warnings"."expires_at" IS DISTINCT FROM EXCLUDED."expires_at"
            OR "official_warnings"."source_url" IS DISTINCT FROM EXCLUDED."source_url"
            OR "official_warnings"."raw_provider_metadata" IS DISTINCT FROM EXCLUDED."raw_provider_metadata"
          THEN CURRENT_TIMESTAMP
          ELSE "official_warnings"."updated_at"
        END
      RETURNING "id"::text AS id, (xmax = 0) AS inserted
    `);

    const identity = rows[0];
    if (!identity) {
      throw new Error('Official warning upsert returned no identity');
    }
    const record = await this.findByIdWithClient(transaction, identity.id);
    if (!record) {
      throw new Error('Official warning was written but could not be read back');
    }
    return { record, inserted: identity.inserted };
  }

  async expireDue(): Promise<
    Array<{
      id: string;
      authority: string;
      externalId: string;
      expiresAt: Date | null;
      updatedAt: Date;
    }>
  > {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        authority: string;
        externalId: string;
        expiresAt: Date | null;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      UPDATE "official_warnings"
      SET "status" = CAST('EXPIRED' AS "OfficialWarningStatus"),
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "status" = CAST('ACTIVE' AS "OfficialWarningStatus")
        AND "expires_at" IS NOT NULL
        AND "expires_at" <= CURRENT_TIMESTAMP
      RETURNING
        "id"::text AS id,
        "authority" AS authority,
        "external_id" AS "externalId",
        "expires_at" AS "expiresAt",
        "updated_at" AS "updatedAt"
    `);
  }

  private async findByIdWithClient(
    client: DatabaseClient,
    id: string,
  ): Promise<OfficialWarningRecord | null> {
    const rows = await client.$queryRaw<OfficialWarningRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "official_warnings" w
      WHERE w."id" = ${id}::uuid
      LIMIT 1
    `);
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  private buildFilters(filters: OfficialWarningFilters): Prisma.Sql[] {
    const clauses: Prisma.Sql[] = [];

    if (filters.active === true) {
      clauses.push(Prisma.sql`
        w."status" = CAST('ACTIVE' AS "OfficialWarningStatus")
        AND w."effective_at" <= CURRENT_TIMESTAMP
        AND (w."expires_at" IS NULL OR w."expires_at" > CURRENT_TIMESTAMP)
      `);
    } else if (filters.active === false) {
      clauses.push(Prisma.sql`
        (
          w."status" <> CAST('ACTIVE' AS "OfficialWarningStatus")
          OR w."effective_at" > CURRENT_TIMESTAMP
          OR (w."expires_at" IS NOT NULL AND w."expires_at" <= CURRENT_TIMESTAMP)
        )
      `);
    }

    if (filters.status) {
      clauses.push(Prisma.sql`w."status" = CAST(${filters.status} AS "OfficialWarningStatus")`);
    }
    if (filters.longitude !== undefined && filters.latitude !== undefined) {
      clauses.push(Prisma.sql`
        ST_DWithin(
          w."affected_geometry"::geography,
          ST_SetSRID(ST_MakePoint(${filters.longitude}, ${filters.latitude}), 4326)::geography,
          ${filters.radiusMeters}
        )
      `);
    }
    if (filters.issuedFrom) clauses.push(Prisma.sql`w."issued_at" >= ${filters.issuedFrom}`);
    if (filters.issuedTo) clauses.push(Prisma.sql`w."issued_at" <= ${filters.issuedTo}`);
    if (filters.effectiveFrom) {
      clauses.push(Prisma.sql`w."effective_at" >= ${filters.effectiveFrom}`);
    }
    if (filters.effectiveTo) clauses.push(Prisma.sql`w."effective_at" <= ${filters.effectiveTo}`);
    if (filters.updatedSince) {
      clauses.push(Prisma.sql`w."updated_at" >= ${filters.updatedSince}`);
    }

    return clauses.length > 0 ? clauses : [Prisma.sql`TRUE`];
  }

  private selectColumns(): Prisma.Sql {
    return Prisma.sql`
      w."id"::text AS "id",
      w."authority" AS "authority",
      w."external_id" AS "externalId",
      w."title" AS "title",
      w."description" AS "description",
      w."severity" AS "severity",
      w."status" AS "status",
      ST_AsGeoJSON(w."affected_geometry") AS "affectedGeometry",
      w."issued_at" AS "issuedAt",
      w."effective_at" AS "effectiveAt",
      w."expires_at" AS "expiresAt",
      w."source_url" AS "sourceUrl",
      w."created_at" AS "createdAt",
      w."updated_at" AS "updatedAt"
    `;
  }

  private toRecord(row: OfficialWarningRow): OfficialWarningRecord {
    const parsed = JSON.parse(row.affectedGeometry) as OfficialWarningGeometry;
    return { ...row, affectedGeometry: parsed };
  }
}

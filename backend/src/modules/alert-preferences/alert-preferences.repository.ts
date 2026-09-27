import { Injectable } from '@nestjs/common';
import { IncidentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AlertPreferenceRecord } from './alert-preference.types';

interface AlertPreferenceRow {
  id: string;
  userId: string;
  savedPlaceId: string | null;
  radiusMeters: number;
  incidentTypes: IncidentType[];
  createdAt: Date;
  updatedAt: Date;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw'> | Prisma.TransactionClient;

@Injectable()
export class AlertPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDefault(userId: string): Promise<AlertPreferenceRecord | null> {
    return this.findDefaultWithClient(this.prisma, userId);
  }

  async ensureDefault(
    userId: string,
    radiusMeters: number,
    incidentTypes: IncidentType[],
  ): Promise<AlertPreferenceRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<AlertPreferenceRow[]>(Prisma.sql`
        INSERT INTO "alert_preferences" (
          "user_id", "saved_place_id", "radius_meters", "incident_types"
        ) VALUES (
          ${userId}::uuid,
          NULL,
          ${radiusMeters},
          ${this.incidentTypesSql(incidentTypes)}
        )
        ON CONFLICT ("user_id") WHERE "saved_place_id" IS NULL DO NOTHING
        RETURNING ${this.selectColumns()}
      `);
      if (rows[0]) return rows[0];
      const existing = await this.findDefaultWithClient(transaction, userId);
      if (!existing) throw new Error('Default alert preferences could not be created or read');
      return existing;
    });
  }

  async upsertDefault(
    userId: string,
    radiusMeters: number,
    incidentTypes: IncidentType[],
  ): Promise<AlertPreferenceRecord> {
    const rows = await this.prisma.$queryRaw<AlertPreferenceRow[]>(Prisma.sql`
      INSERT INTO "alert_preferences" (
        "user_id", "saved_place_id", "radius_meters", "incident_types"
      ) VALUES (
        ${userId}::uuid,
        NULL,
        ${radiusMeters},
        ${this.incidentTypesSql(incidentTypes)}
      )
      ON CONFLICT ("user_id") WHERE "saved_place_id" IS NULL DO UPDATE SET
        "radius_meters" = EXCLUDED."radius_meters",
        "incident_types" = EXCLUDED."incident_types",
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING ${this.selectColumns()}
    `);
    const preference = rows[0];
    if (!preference) throw new Error('Alert preferences were updated but could not be read back');
    return preference;
  }

  async findEffective(
    userId: string,
    savedPlaceId: string | null,
  ): Promise<AlertPreferenceRecord | null> {
    const placeClause = savedPlaceId
      ? Prisma.sql`("saved_place_id" = ${savedPlaceId}::uuid OR "saved_place_id" IS NULL)`
      : Prisma.sql`"saved_place_id" IS NULL`;
    const rows = await this.prisma.$queryRaw<AlertPreferenceRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "alert_preferences"
      WHERE "user_id" = ${userId}::uuid
        AND ${placeClause}
      ORDER BY
        CASE WHEN "saved_place_id" = ${savedPlaceId ?? null}::uuid THEN 0 ELSE 1 END,
        "updated_at" DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findDefaultWithClient(
    client: DatabaseClient,
    userId: string,
  ): Promise<AlertPreferenceRecord | null> {
    const rows = await client.$queryRaw<AlertPreferenceRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "alert_preferences"
      WHERE "user_id" = ${userId}::uuid
        AND "saved_place_id" IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private incidentTypesSql(incidentTypes: IncidentType[]): Prisma.Sql {
    return Prisma.sql`ARRAY[
      ${Prisma.join(
        incidentTypes.map((incidentType) => Prisma.sql`${incidentType}::"IncidentType"`),
        ', ',
      )}
    ]::"IncidentType"[]`;
  }

  private selectColumns(): Prisma.Sql {
    return Prisma.sql`
      "id"::text AS "id",
      "user_id"::text AS "userId",
      "saved_place_id"::text AS "savedPlaceId",
      "radius_meters" AS "radiusMeters",
      "incident_types" AS "incidentTypes",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    `;
  }
}

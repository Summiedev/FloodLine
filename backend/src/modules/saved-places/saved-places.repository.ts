import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  SavedPlaceCreateInput,
  SavedPlaceFilters,
  SavedPlaceMatch,
  SavedPlaceRecord,
  SavedPlaceUpdateInput,
} from './saved-place.types';

interface SavedPlaceRow {
  id: string;
  userId: string;
  type: SavedPlaceRecord['type'];
  customLabel: string | null;
  longitude: number;
  latitude: number;
  formattedAddress: string;
  providerPlaceId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedPlaceMatchRow extends SavedPlaceRow {
  distanceMeters: number;
}

@Injectable()
export class SavedPlacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUser(
    filters: SavedPlaceFilters,
  ): Promise<{ rows: SavedPlaceRecord[]; total: number }> {
    const countQuery = this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "saved_places"
      WHERE "user_id" = ${filters.userId}::uuid
    `);
    const rowsQuery = this.prisma.$queryRaw<SavedPlaceRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "saved_places" sp
      WHERE sp."user_id" = ${filters.userId}::uuid
      ORDER BY sp."is_active" DESC, sp."updated_at" DESC, sp."id" DESC
      LIMIT ${filters.pageSize}
      OFFSET ${(filters.page - 1) * filters.pageSize}
    `);
    const [countRows, rows] = await this.prisma.$transaction([countQuery, rowsQuery]);
    return { rows, total: Number(countRows[0]?.count ?? 0n) };
  }

  async findOwnedById(id: string, userId: string): Promise<SavedPlaceRecord | null> {
    const rows = await this.prisma.$queryRaw<SavedPlaceRow[]>(Prisma.sql`
      SELECT ${this.selectColumns()}
      FROM "saved_places" sp
      WHERE sp."id" = ${id}::uuid
        AND sp."user_id" = ${userId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async create(input: SavedPlaceCreateInput, id: string): Promise<SavedPlaceRecord> {
    const rows = await this.prisma.$queryRaw<SavedPlaceRow[]>(Prisma.sql`
      INSERT INTO "saved_places" (
        "id", "user_id", "type", "custom_label", "location", "formatted_address", "provider_place_id"
      ) VALUES (
        ${id}::uuid,
        ${input.userId}::uuid,
        CAST(${input.type} AS "SavedPlaceType"),
        ${input.customLabel ?? null},
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
        ${input.formattedAddress},
        ${input.providerPlaceId ?? null}
      )
      RETURNING ${this.returningColumns()}
    `);
    const place = rows[0];
    if (!place) throw new Error('Saved place was created but could not be read back');
    return place;
  }

  async updateOwned(
    id: string,
    userId: string,
    input: SavedPlaceUpdateInput,
  ): Promise<SavedPlaceRecord | null> {
    const assignments: Prisma.Sql[] = [];
    if (input.type !== undefined) {
      assignments.push(Prisma.sql`"type" = CAST(${input.type} AS "SavedPlaceType")`);
    }
    if (input.customLabel !== undefined) {
      assignments.push(Prisma.sql`"custom_label" = ${input.customLabel}`);
    }
    if (input.longitude !== undefined && input.latitude !== undefined) {
      assignments.push(
        Prisma.sql`"location" = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`,
      );
    }
    if (input.formattedAddress !== undefined) {
      assignments.push(Prisma.sql`"formatted_address" = ${input.formattedAddress}`);
    }
    if (input.providerPlaceId !== undefined) {
      assignments.push(Prisma.sql`"provider_place_id" = ${input.providerPlaceId}`);
    }
    if (input.isActive !== undefined) {
      assignments.push(Prisma.sql`"is_active" = ${input.isActive}`);
    }
    if (assignments.length === 0) return this.findOwnedById(id, userId);

    assignments.push(Prisma.sql`"updated_at" = CURRENT_TIMESTAMP`);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "saved_places"
      SET ${Prisma.join(assignments, ', ')}
      WHERE "id" = ${id}::uuid
        AND "user_id" = ${userId}::uuid
      RETURNING "id"::text AS id
    `);
    return rows[0] ? this.findOwnedById(id, userId) : null;
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "saved_places"
      WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid
    `);
    return result > 0;
  }

  async findWithinIncidentRadius(
    incidentId: string,
    radiusMeters: number,
  ): Promise<SavedPlaceMatch[]> {
    const rows = await this.prisma.$queryRaw<SavedPlaceMatchRow[]>(Prisma.sql`
      SELECT
        ${this.selectColumns()},
        LEAST(
          ST_Distance(sp."location", i."location"),
          CASE
            WHEN i."affected_geometry" IS NULL THEN 1e30::double precision
            ELSE ST_Distance(sp."location", i."affected_geometry"::geography)
          END
        )::double precision AS "distanceMeters"
      FROM "saved_places" sp
      INNER JOIN "incidents" i ON i."id" = ${incidentId}::uuid
      WHERE sp."is_active" = TRUE
        AND i."status" = CAST('ACTIVE' AS "IncidentStatus")
        AND (i."expires_at" IS NULL OR i."expires_at" > CURRENT_TIMESTAMP)
        AND (
          ST_DWithin(sp."location", i."location", ${radiusMeters})
          OR (
            i."affected_geometry" IS NOT NULL
            AND ST_DWithin(sp."location", i."affected_geometry"::geography, ${radiusMeters})
          )
        )
      ORDER BY "distanceMeters" ASC, sp."id" ASC
    `);
    return rows;
  }

  private selectColumns(): Prisma.Sql {
    return Prisma.sql`
      sp."id"::text AS "id",
      sp."user_id"::text AS "userId",
      sp."type" AS "type",
      sp."custom_label" AS "customLabel",
      ST_X(sp."location"::geometry)::double precision AS "longitude",
      ST_Y(sp."location"::geometry)::double precision AS "latitude",
      sp."formatted_address" AS "formattedAddress",
      sp."provider_place_id" AS "providerPlaceId",
      sp."is_active" AS "isActive",
      sp."created_at" AS "createdAt",
      sp."updated_at" AS "updatedAt"
    `;
  }

  private returningColumns(): Prisma.Sql {
    return Prisma.sql`
      "id"::text AS "id",
      "user_id"::text AS "userId",
      "type" AS "type",
      "custom_label" AS "customLabel",
      ST_X("location"::geometry)::double precision AS "longitude",
      ST_Y("location"::geometry)::double precision AS "latitude",
      "formatted_address" AS "formattedAddress",
      "provider_place_id" AS "providerPlaceId",
      "is_active" AS "isActive",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    `;
  }
}

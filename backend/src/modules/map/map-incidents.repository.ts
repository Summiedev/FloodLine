import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { MapIncidentFilters } from './map.types';

interface MapIncidentRow {
  id: string;
  longitude: number;
  latitude: number;
  incidentType: string;
  severity: string;
  confidenceLabel: string;
  status: string;
  updatedAt: Date;
}

@Injectable()
export class MapIncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMarkers(filters: MapIncidentFilters): Promise<MapIncidentRow[]> {
    const clauses: Prisma.Sql[] = [this.boundsClause(filters)];
    if (filters.incidentTypes?.length) {
      clauses.push(
        Prisma.sql`i."incident_type" IN (${Prisma.join(
          filters.incidentTypes.map((type) => Prisma.sql`CAST(${type} AS "IncidentType")`),
          ', ',
        )})`,
      );
    }
    const activeOrChanged = filters.updatedSince
      ? Prisma.sql`(
          (
            i."status" = CAST('ACTIVE' AS "IncidentStatus")
            AND (i."expires_at" IS NULL OR i."expires_at" > CURRENT_TIMESTAMP)
          )
          OR (i."updated_at" >= ${filters.updatedSince} AND i."status" <> CAST('ACTIVE' AS "IncidentStatus"))
        )`
      : Prisma.sql`
          i."status" = CAST('ACTIVE' AS "IncidentStatus")
          AND (i."expires_at" IS NULL OR i."expires_at" > CURRENT_TIMESTAMP)
        `;
    clauses.push(activeOrChanged);
    if (filters.updatedSince) clauses.push(Prisma.sql`i."updated_at" >= ${filters.updatedSince}`);

    return this.prisma.$queryRaw<MapIncidentRow[]>(Prisma.sql`
      SELECT
        i."id"::text AS "id",
        ST_X(i."location"::geometry)::double precision AS "longitude",
        ST_Y(i."location"::geometry)::double precision AS "latitude",
        i."incident_type"::text AS "incidentType",
        i."severity"::text AS "severity",
        i."confidence_label"::text AS "confidenceLabel",
        i."status"::text AS "status",
        i."updated_at" AS "updatedAt"
      FROM "incidents" i
      WHERE ${Prisma.join(clauses, ' AND ')}
      ORDER BY i."updated_at" DESC, i."id" DESC
      LIMIT ${filters.limit + 1}
    `);
  }

  private boundsClause(filters: MapIncidentFilters): Prisma.Sql {
    if (filters.west < filters.east) {
      return Prisma.sql`
        i."location" && ST_MakeEnvelope(
          ${filters.west}, ${filters.south}, ${filters.east}, ${filters.north}, 4326
        )::geography
        AND ST_Intersects(
          i."location",
          ST_MakeEnvelope(${filters.west}, ${filters.south}, ${filters.east}, ${filters.north}, 4326)::geography
        )
      `;
    }
    return Prisma.sql`(
      (
        i."location" && ST_MakeEnvelope(
          ${filters.west}, ${filters.south}, 180, ${filters.north}, 4326
        )::geography
        AND ST_Intersects(
          i."location",
          ST_MakeEnvelope(${filters.west}, ${filters.south}, 180, ${filters.north}, 4326)::geography
        )
      )
      OR (
        i."location" && ST_MakeEnvelope(
          -180, ${filters.south}, ${filters.east}, ${filters.north}, 4326
        )::geography
        AND ST_Intersects(
          i."location",
          ST_MakeEnvelope(-180, ${filters.south}, ${filters.east}, ${filters.north}, 4326)::geography
        )
      )
    )`;
  }
}

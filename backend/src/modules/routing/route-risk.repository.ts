import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RouteLineString, RouteRiskIncidentSummary } from './routing.types';

@Injectable()
export class RouteRiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The corridor predicate is evaluated by PostGIS and uses the incident location GiST index. */
  async findActiveIncidentsNearRoute(
    geometry: RouteLineString,
    corridorMeters: number,
  ): Promise<RouteRiskIncidentSummary[]> {
    const geometryJson = JSON.stringify(geometry);
    return this.prisma.$queryRaw<RouteRiskIncidentSummary[]>(Prisma.sql`
      WITH route AS (
        SELECT
          ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)::geography AS geog
      )
      SELECT
        i."id"::text AS "id",
        i."incident_type"::text AS "incidentType",
        i."severity"::text AS "severity",
        i."confidence_label"::text AS "confidenceLabel",
        i."source_type"::text AS "sourceType",
        i."location_name" AS "locationName",
        LEAST(
          ST_Distance(i."location", route.geog),
          CASE
            WHEN i."affected_geometry" IS NULL THEN ST_Distance(i."location", route.geog)
            ELSE ST_Distance(i."affected_geometry"::geography, route.geog)
          END
        )::double precision AS "distanceMeters",
        i."updated_at" AS "updatedAt"
      FROM "incidents" i
      CROSS JOIN route
      WHERE i."status" = CAST('ACTIVE' AS "IncidentStatus")
        AND (i."expires_at" IS NULL OR i."expires_at" > CURRENT_TIMESTAMP)
        AND (
          ST_DWithin(i."location", route.geog, ${corridorMeters})
          OR (
            i."affected_geometry" IS NOT NULL
            AND ST_DWithin(i."affected_geometry"::geography, route.geog, ${corridorMeters})
          )
        )
      ORDER BY "distanceMeters" ASC, i."updated_at" DESC, i."id" ASC
    `);
  }
}

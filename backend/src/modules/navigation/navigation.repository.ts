import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type { RoutePreviewRoute, RouteRiskResult } from '../routing/routing.types';
import type {
  NavigationRouteUpdateRecord,
  NavigationSessionCreateInput,
  NavigationSessionRecord,
} from './navigation.types';

interface SessionRow {
  id: string;
  userId: string;
  routeFingerprint: string;
  routeGeometry: string;
  originLongitude: number;
  originLatitude: number;
  destinationLongitude: number;
  destinationLatitude: number;
  travelMode: string;
  status: string;
  startedAt: Date;
  lastRouteUpdateAt: Date;
  lastReroutedAt: Date | null;
  expiresAt: Date;
  currentRiskScore: number | null;
  currentRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | null;
  currentAffectingIncidentCount: number;
  currentSevereIncidentCount: number;
  routeDistanceMeters: number;
  routeDurationSeconds: number;
}

interface UpdateRow {
  id: string;
  sessionId: string;
  userId: string;
  triggeringIncidentId: string;
  previousRouteFingerprint: string;
  newRouteFingerprint: string;
  previousRiskScore: number | null;
  newRiskScore: number;
  newRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  newAffectingIncidentCount: number;
  newSevereIncidentCount: number;
  reason: string;
  routeGeometry: string;
  routeDistanceMeters: number;
  routeDurationSeconds: number;
  status: 'PENDING' | 'SENT' | 'FAILED';
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  travelMode: string;
  triggeringIncidentLocationName: string;
}

type DatabaseClient = Pick<PrismaService, '$queryRaw' | '$executeRaw'> | Prisma.TransactionClient;

export interface ApplyRouteUpdateInput {
  sessionId: string;
  triggeringIncidentId: string;
  previousRouteFingerprint: string;
  previousRiskScore: number | null;
  route: RoutePreviewRoute;
  reason: string;
  cooldownSeconds: number;
}

@Injectable()
export class NavigationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NavigationSessionCreateInput): Promise<NavigationSessionRecord> {
    const id = randomUUID();
    return this.prisma.$transaction(async (transaction) => {
      await this.insertSession(transaction, id, input);
      const session = await this.findByIdWithClient(transaction, id, input.userId);
      if (!session) throw new Error('Navigation session was created but could not be read');
      return session;
    });
  }

  async findOwnedById(id: string, userId: string): Promise<NavigationSessionRecord | null> {
    return this.findByIdWithClient(this.prisma, id, userId);
  }

  async cancelOwned(id: string, userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "active_navigation_sessions"
      SET "status" = CAST('CANCELLED' AS "NavigationSessionStatus"),
          "last_route_update_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
        AND "user_id" = ${userId}::uuid
        AND "status" = CAST('ACTIVE' AS "NavigationSessionStatus")
      RETURNING "id"::text AS id
    `);
    if (rows[0]) return true;

    const owned = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"::text AS id
      FROM "active_navigation_sessions"
      WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid
      LIMIT 1
    `);
    return Boolean(owned[0]);
  }

  async expireDue(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "active_navigation_sessions"
      SET "status" = CAST('EXPIRED' AS "NavigationSessionStatus"),
          "last_route_update_at" = CURRENT_TIMESTAMP
      WHERE "status" = CAST('ACTIVE' AS "NavigationSessionStatus")
        AND "expires_at" <= CURRENT_TIMESTAMP
      RETURNING "id"::text AS id
    `);
    return rows.length;
  }

  async updateCurrentRisk(sessionId: string, risk: RouteRiskResult): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "active_navigation_sessions"
      SET "current_risk_score" = ${risk.riskScore},
          "current_risk_level" = CAST(${risk.riskLevel} AS "RouteRiskLevel"),
          "current_affecting_incident_count" = ${risk.affectingIncidentCount},
          "current_severe_incident_count" = ${risk.severeIncidentCount},
          "last_route_update_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${sessionId}::uuid
        AND "status" = CAST('ACTIVE' AS "NavigationSessionStatus")
    `);
  }

  async findAffectedActiveSessions(
    incidentId: string,
    corridorMeters: number,
    batchSize: number,
    afterId?: string,
  ): Promise<NavigationSessionRecord[]> {
    const cursor = afterId ? Prisma.sql`AND s."id"::text > ${afterId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<SessionRow[]>(Prisma.sql`
      WITH hazard AS (
        SELECT "location", "affected_geometry"
        FROM "incidents"
        WHERE "id" = ${incidentId}::uuid
          AND "status" = CAST('ACTIVE' AS "IncidentStatus")
          AND ("expires_at" IS NULL OR "expires_at" > CURRENT_TIMESTAMP)
      )
      SELECT ${this.selectSessionColumns()}
      FROM "active_navigation_sessions" s
      CROSS JOIN hazard h
      WHERE s."status" = CAST('ACTIVE' AS "NavigationSessionStatus")
        AND s."expires_at" > CURRENT_TIMESTAMP
        ${cursor}
        AND (
          ST_DWithin(s."route_geometry"::geography, h."location", ${corridorMeters})
          OR (
            h."affected_geometry" IS NOT NULL
            AND ST_DWithin(s."route_geometry"::geography, h."affected_geometry"::geography, ${corridorMeters})
          )
        )
      ORDER BY s."id" ASC
      LIMIT ${batchSize}
    `);
    return rows.map((row) => this.toSession(row, []));
  }

  async applyRouteUpdate(
    input: ApplyRouteUpdateInput,
  ): Promise<NavigationRouteUpdateRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.$queryRaw<
        Array<{ userId: string; lastReroutedAt: Date | null }>
      >(
        Prisma.sql`
          SELECT "user_id"::text AS "userId", "last_rerouted_at" AS "lastReroutedAt"
          FROM "active_navigation_sessions"
          WHERE "id" = ${input.sessionId}::uuid
            AND "status" = CAST('ACTIVE' AS "NavigationSessionStatus")
            AND "expires_at" > CURRENT_TIMESTAMP
          FOR UPDATE
        `,
      );
      const session = sessions[0];
      if (!session) return null;
      if (
        session.lastReroutedAt &&
        session.lastReroutedAt.getTime() > Date.now() - input.cooldownSeconds * 1_000
      ) {
        return null;
      }

      const geometryJson = JSON.stringify(input.route.geometry);
      const inserted = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "route_updates" (
          "session_id", "triggering_incident_id", "previous_route_fingerprint",
          "new_route_fingerprint", "previous_risk_score", "new_risk_score", "new_risk_level",
          "new_affecting_incident_count", "new_severe_incident_count", "reason", "route_geometry",
          "route_distance_meters", "route_duration_seconds", "status"
        ) VALUES (
          ${input.sessionId}::uuid,
          ${input.triggeringIncidentId}::uuid,
          ${input.previousRouteFingerprint},
          ${input.route.id},
          ${input.previousRiskScore},
          ${input.route.risk.riskScore},
          CAST(${input.route.risk.riskLevel} AS "RouteRiskLevel"),
          ${input.route.risk.affectingIncidentCount},
          ${input.route.risk.severeIncidentCount},
          ${input.reason},
          ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
          ${input.route.distanceMeters},
          ${input.route.durationSeconds},
          CAST('PENDING' AS "NavigationRouteUpdateStatus")
        )
        ON CONFLICT ("session_id", "triggering_incident_id") DO NOTHING
        RETURNING "id"::text AS id
      `);
      if (!inserted[0]) return null;

      await transaction.$executeRaw(Prisma.sql`
        UPDATE "active_navigation_sessions"
        SET "route_fingerprint" = ${input.route.id},
            "route_geometry" = ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
            "travel_mode" = CAST(${input.route.travelMode} AS "TravelMode"),
            "last_route_update_at" = CURRENT_TIMESTAMP,
            "last_rerouted_at" = CURRENT_TIMESTAMP,
            "current_risk_score" = ${input.route.risk.riskScore},
            "current_risk_level" = CAST(${input.route.risk.riskLevel} AS "RouteRiskLevel"),
            "current_affecting_incident_count" = ${input.route.risk.affectingIncidentCount},
            "current_severe_incident_count" = ${input.route.risk.severeIncidentCount},
            "route_distance_meters" = ${input.route.distanceMeters},
            "route_duration_seconds" = ${input.route.durationSeconds}
        WHERE "id" = ${input.sessionId}::uuid
      `);

      return this.findRouteUpdateWithClient(transaction, inserted[0].id);
    });
  }

  async findRouteUpdateForDelivery(id: string): Promise<NavigationRouteUpdateRecord | null> {
    return this.findRouteUpdateWithClient(this.prisma, id);
  }

  async markRouteUpdateSent(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "route_updates"
      SET "status" = CAST('SENT' AS "NavigationRouteUpdateStatus"),
          "sent_at" = CURRENT_TIMESTAMP,
          "last_error" = NULL
      WHERE "id" = ${id}::uuid
        AND "status" <> CAST('SENT' AS "NavigationRouteUpdateStatus")
    `);
  }

  async markRouteUpdateFailed(id: string, error: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "route_updates"
      SET "status" = CAST('FAILED' AS "NavigationRouteUpdateStatus"),
          "last_error" = ${error.slice(0, 2_000)}
      WHERE "id" = ${id}::uuid
        AND "status" <> CAST('SENT' AS "NavigationRouteUpdateStatus")
    `);
  }

  private async insertSession(
    transaction: Prisma.TransactionClient,
    id: string,
    input: NavigationSessionCreateInput,
  ): Promise<void> {
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "active_navigation_sessions" (
        "id", "user_id", "route_fingerprint", "route_geometry", "origin", "destination",
        "travel_mode", "status", "expires_at", "current_risk_score", "current_risk_level",
        "current_affecting_incident_count", "current_severe_incident_count",
        "route_distance_meters", "route_duration_seconds"
      ) VALUES (
        ${id}::uuid,
        ${input.userId}::uuid,
        ${input.routeFingerprint},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.routeGeometry)}), 4326),
        ST_SetSRID(ST_MakePoint(${input.origin.longitude}, ${input.origin.latitude}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${input.destination.longitude}, ${input.destination.latitude}), 4326)::geography,
        CAST(${input.travelMode} AS "TravelMode"),
        CAST('ACTIVE' AS "NavigationSessionStatus"),
        ${input.expiresAt},
        ${input.currentRiskScore},
        CAST(${input.currentRiskLevel} AS "RouteRiskLevel"),
        ${input.currentAffectingIncidentCount},
        ${input.currentSevereIncidentCount},
        ${input.routeDistanceMeters},
        ${input.routeDurationSeconds}
      )
    `);
  }

  private async findByIdWithClient(
    client: DatabaseClient,
    id: string,
    userId: string,
  ): Promise<NavigationSessionRecord | null> {
    const rows = await client.$queryRaw<SessionRow[]>(Prisma.sql`
      SELECT ${this.selectSessionColumns()}
      FROM "active_navigation_sessions" s
      WHERE s."id" = ${id}::uuid AND s."user_id" = ${userId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) return null;
    const updates = await client.$queryRaw<UpdateRow[]>(Prisma.sql`
      SELECT ${this.selectUpdateColumns()}
      FROM "route_updates" u
      INNER JOIN "active_navigation_sessions" s ON s."id" = u."session_id"
      INNER JOIN "incidents" i ON i."id" = u."triggering_incident_id"
      WHERE u."session_id" = ${id}::uuid AND s."user_id" = ${userId}::uuid
      ORDER BY u."created_at" DESC, u."id" DESC
      LIMIT 20
    `);
    return this.toSession(
      rows[0],
      updates.map((row) => this.toUpdate(row)),
    );
  }

  private async findRouteUpdateWithClient(
    client: DatabaseClient,
    id: string,
  ): Promise<NavigationRouteUpdateRecord | null> {
    const rows = await client.$queryRaw<UpdateRow[]>(Prisma.sql`
      SELECT ${this.selectUpdateColumns()}
      FROM "route_updates" u
      INNER JOIN "active_navigation_sessions" s ON s."id" = u."session_id"
      INNER JOIN "incidents" i ON i."id" = u."triggering_incident_id"
      WHERE u."id" = ${id}::uuid
      LIMIT 1
    `);
    return rows[0] ? this.toUpdate(rows[0]) : null;
  }

  private selectSessionColumns(): Prisma.Sql {
    return Prisma.sql`
      s."id"::text AS "id",
      s."user_id"::text AS "userId",
      s."route_fingerprint" AS "routeFingerprint",
      ST_AsGeoJSON(s."route_geometry") AS "routeGeometry",
      ST_X(s."origin"::geometry)::double precision AS "originLongitude",
      ST_Y(s."origin"::geometry)::double precision AS "originLatitude",
      ST_X(s."destination"::geometry)::double precision AS "destinationLongitude",
      ST_Y(s."destination"::geometry)::double precision AS "destinationLatitude",
      s."travel_mode"::text AS "travelMode",
      CASE
        WHEN s."status" = CAST('ACTIVE' AS "NavigationSessionStatus")
          AND s."expires_at" <= CURRENT_TIMESTAMP
        THEN CAST('EXPIRED' AS "NavigationSessionStatus")
        ELSE s."status"
      END::text AS "status",
      s."started_at" AS "startedAt",
      s."last_route_update_at" AS "lastRouteUpdateAt",
      s."last_rerouted_at" AS "lastReroutedAt",
      s."expires_at" AS "expiresAt",
      s."current_risk_score"::double precision AS "currentRiskScore",
      s."current_risk_level"::text AS "currentRiskLevel",
      s."current_affecting_incident_count" AS "currentAffectingIncidentCount",
      s."current_severe_incident_count" AS "currentSevereIncidentCount",
      s."route_distance_meters"::double precision AS "routeDistanceMeters",
      s."route_duration_seconds" AS "routeDurationSeconds"
    `;
  }

  private selectUpdateColumns(): Prisma.Sql {
    return Prisma.sql`
      u."id"::text AS "id",
      u."session_id"::text AS "sessionId",
      s."user_id"::text AS "userId",
      u."triggering_incident_id"::text AS "triggeringIncidentId",
      u."previous_route_fingerprint" AS "previousRouteFingerprint",
      u."new_route_fingerprint" AS "newRouteFingerprint",
      u."previous_risk_score"::double precision AS "previousRiskScore",
      u."new_risk_score"::double precision AS "newRiskScore",
      u."new_risk_level"::text AS "newRiskLevel",
      u."new_affecting_incident_count" AS "newAffectingIncidentCount",
      u."new_severe_incident_count" AS "newSevereIncidentCount",
      u."reason" AS "reason",
      ST_AsGeoJSON(u."route_geometry") AS "routeGeometry",
      u."route_distance_meters"::double precision AS "routeDistanceMeters",
      u."route_duration_seconds" AS "routeDurationSeconds",
      u."status"::text AS "status",
      u."last_error" AS "lastError",
      u."created_at" AS "createdAt",
      u."sent_at" AS "sentAt",
      s."travel_mode"::text AS "travelMode",
      i."location_name" AS "triggeringIncidentLocationName"
    `;
  }

  private toSession(
    row: SessionRow,
    updates: NavigationRouteUpdateRecord[],
  ): NavigationSessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      routeFingerprint: row.routeFingerprint,
      routeGeometry: JSON.parse(row.routeGeometry) as NavigationSessionRecord['routeGeometry'],
      origin: { longitude: row.originLongitude, latitude: row.originLatitude },
      destination: { longitude: row.destinationLongitude, latitude: row.destinationLatitude },
      travelMode: row.travelMode as NavigationSessionRecord['travelMode'],
      routeDistanceMeters: row.routeDistanceMeters,
      routeDurationSeconds: row.routeDurationSeconds,
      currentRiskScore: row.currentRiskScore ?? 0,
      currentRiskLevel: row.currentRiskLevel ?? 'LOW',
      currentAffectingIncidentCount: row.currentAffectingIncidentCount,
      currentSevereIncidentCount: row.currentSevereIncidentCount,
      expiresAt: row.expiresAt,
      status: row.status as NavigationSessionRecord['status'],
      startedAt: row.startedAt,
      lastRouteUpdateAt: row.lastRouteUpdateAt,
      lastReroutedAt: row.lastReroutedAt,
      updates,
    };
  }

  private toUpdate(row: UpdateRow): NavigationRouteUpdateRecord {
    const summary =
      row.newAffectingIncidentCount === 0
        ? 'No currently known reports'
        : row.newRiskLevel === 'LOW'
          ? 'Lower reported flood risk'
          : 'Flood reports detected';
    return {
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      triggeringIncidentId: row.triggeringIncidentId,
      triggeringIncidentLocationName: row.triggeringIncidentLocationName,
      previousRouteFingerprint: row.previousRouteFingerprint,
      newRouteFingerprint: row.newRouteFingerprint,
      previousRiskScore: row.previousRiskScore,
      newRiskScore: row.newRiskScore,
      reason: row.reason,
      route: {
        id: row.newRouteFingerprint,
        geometry: JSON.parse(row.routeGeometry) as NavigationRouteUpdateRecord['route']['geometry'],
        distanceMeters: row.routeDistanceMeters,
        durationSeconds: row.routeDurationSeconds,
        travelMode: row.travelMode as NavigationRouteUpdateRecord['route']['travelMode'],
        risk: {
          riskScore: row.newRiskScore,
          riskLevel: row.newRiskLevel,
          affectingIncidentCount: row.newAffectingIncidentCount,
          severeIncidentCount: row.newSevereIncidentCount,
          avoidedIncidentCount: null,
          incidents: [],
          summary,
        },
      },
      status: row.status,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    };
  }
}

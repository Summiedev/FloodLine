import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RouteRiskService } from '../routing/route-risk.service';
import { RoutingService } from '../routing/routing.service';
import type { RouteLineString, RoutePreviewRoute } from '../routing/routing.types';
import {
  NAVIGATION_EVALUATE_INCIDENT_JOB,
  NAVIGATION_ROUTE_UPDATE_DELIVERY_JOB,
} from './navigation.constants';
import { NavigationRepository } from './navigation.repository';
import type { NavigationUpdateTransport } from './navigation-update.transport';
import type {
  NavigationRouteUpdateEvent,
  NavigationSessionRecord,
  NavigationSessionStartInput,
} from './navigation.types';

@Injectable()
export class NavigationService {
  private readonly sessionTtlMs: number;
  private readonly rerouteCooldownSeconds: number;
  private readonly minimumRiskImprovement: number;
  private readonly maximumDurationOverheadRatio: number;
  private readonly evaluationBatchSize: number;
  private readonly corridorMeters: number;

  constructor(
    private readonly repository: NavigationRepository,
    private readonly routeRiskService: RouteRiskService,
    private readonly routingService: RoutingService,
    private readonly queueService: QueueService,
    private readonly logger: StructuredLogger,
    private readonly updateTransport: NavigationUpdateTransport,
    configService: ConfigService,
  ) {
    this.sessionTtlMs =
      configService.getOrThrow<number>('navigation.sessionTtlMinutes') * 60 * 1_000;
    this.rerouteCooldownSeconds = configService.getOrThrow<number>(
      'navigation.rerouteCooldownSeconds',
    );
    this.minimumRiskImprovement = configService.getOrThrow<number>(
      'navigation.minimumRiskImprovement',
    );
    this.maximumDurationOverheadRatio = configService.getOrThrow<number>(
      'navigation.maximumDurationOverheadRatio',
    );
    this.evaluationBatchSize = configService.getOrThrow<number>('navigation.evaluationBatchSize');
    this.corridorMeters = configService.getOrThrow<number>('routeRisk.corridorMeters');
  }

  async start(userId: string, input: NavigationSessionStartInput) {
    this.assertUuid(userId, 'userId');
    this.validateCoordinate(input.origin, 'origin');
    this.validateCoordinate(input.destination, 'destination');
    this.validateGeometry(input.route.geometry);
    if (!Number.isFinite(input.route.distanceMeters) || input.route.distanceMeters < 0) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'route.distanceMeters is invalid');
    }
    if (!Number.isInteger(input.route.durationSeconds) || input.route.durationSeconds <= 0) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'route.durationSeconds must be a positive integer',
      );
    }

    const risk = await this.routeRiskService.evaluate(input.route.geometry);
    const routeFingerprint = input.route.id?.trim() || this.fingerprint(input);
    const session = await this.repository.create({
      userId,
      routeFingerprint,
      routeGeometry: input.route.geometry,
      origin: input.origin,
      destination: input.destination,
      travelMode: input.travelMode,
      routeDistanceMeters: input.route.distanceMeters,
      routeDurationSeconds: input.route.durationSeconds,
      currentRiskScore: risk.riskScore,
      currentRiskLevel: risk.riskLevel,
      currentAffectingIncidentCount: risk.affectingIncidentCount,
      currentSevereIncidentCount: risk.severeIncidentCount,
      expiresAt: new Date(Date.now() + this.sessionTtlMs),
    });
    return this.toResponse(session);
  }

  async findOwned(userId: string, sessionId: string) {
    this.assertUuid(userId, 'userId');
    this.assertUuid(sessionId, 'sessionId');
    const session = await this.repository.findOwnedById(sessionId, userId);
    if (!session) throw new NotFoundException('Navigation session not found');
    return this.toResponse(session);
  }

  async cancel(userId: string, sessionId: string): Promise<void> {
    this.assertUuid(userId, 'userId');
    this.assertUuid(sessionId, 'sessionId');
    const cancelled = await this.repository.cancelOwned(sessionId, userId);
    if (!cancelled) throw new NotFoundException('Navigation session not found');
  }

  async enqueueIncidentEvaluation(incidentId: string, eventId: string): Promise<void> {
    this.assertUuid(incidentId, 'incidentId');
    const stableEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
    try {
      await this.queueService.enqueueSystemJob(
        NAVIGATION_EVALUATE_INCIDENT_JOB,
        { incidentId },
        {
          jobId: `navigation-incident-${incidentId}-${stableEventId}`,
          attempts: 3,
          backoffMs: 1_000,
        },
      );
    } catch (error) {
      this.logger.error(
        error,
        error instanceof Error ? error.stack : undefined,
        'NavigationService.enqueueIncidentEvaluation',
      );
    }
  }

  async evaluateIncidentImpact(incidentId: string): Promise<number> {
    this.assertUuid(incidentId, 'incidentId');
    let cursor: string | undefined;
    let rerouted = 0;
    while (true) {
      const sessions = await this.repository.findAffectedActiveSessions(
        incidentId,
        this.corridorMeters,
        this.evaluationBatchSize,
        cursor,
      );
      if (sessions.length === 0) break;
      for (const session of sessions) {
        if (await this.evaluateSession(session, incidentId)) rerouted += 1;
      }
      cursor = sessions[sessions.length - 1]?.id;
      if (sessions.length < this.evaluationBatchSize) break;
    }
    return rerouted;
  }

  async deliverRouteUpdate(updateId: string): Promise<void> {
    this.assertUuid(updateId, 'updateId');
    const update = await this.repository.findRouteUpdateForDelivery(updateId);
    if (!update || update.status === 'SENT') return;

    const event: NavigationRouteUpdateEvent = {
      updateId: update.id,
      userId: update.userId,
      sessionId: update.sessionId,
      title: 'Route updated',
      body: `Avoiding reported flooding on ${update.triggeringIncidentLocationName}`,
      route: update.route,
    };
    try {
      await this.updateTransport.publish(event);
      await this.repository.markRouteUpdateSent(update.id);
    } catch (error) {
      await this.repository.markRouteUpdateFailed(
        update.id,
        error instanceof Error ? error.message : 'Navigation update transport failed',
      );
      throw error;
    }
  }

  async expireStaleSessions(): Promise<number> {
    return this.repository.expireDue();
  }

  private async evaluateSession(
    session: NavigationSessionRecord,
    incidentId: string,
  ): Promise<boolean> {
    if (
      session.lastReroutedAt &&
      session.lastReroutedAt.getTime() > Date.now() - this.rerouteCooldownSeconds * 1_000
    ) {
      return false;
    }

    try {
      const currentRisk = await this.routeRiskService.evaluate(session.routeGeometry);
      const riskIncrease = currentRisk.riskScore - session.currentRiskScore;
      if (riskIncrease < this.minimumRiskImprovement) return false;
      await this.repository.updateCurrentRisk(session.id, currentRisk);

      const preview = await this.routingService.preview(
        {
          origin: session.origin,
          destination: session.destination,
          travelMode: session.travelMode,
        },
        { bypassCache: true },
      );
      const alternative = this.findMeaningfulAlternative(
        preview.routes,
        session,
        currentRisk.riskScore,
      );
      if (!alternative) return false;

      const update = await this.repository.applyRouteUpdate({
        sessionId: session.id,
        triggeringIncidentId: incidentId,
        previousRouteFingerprint: session.routeFingerprint,
        previousRiskScore: session.currentRiskScore,
        route: alternative,
        reason: 'LOWER_REPORTED_FLOOD_RISK',
        cooldownSeconds: this.rerouteCooldownSeconds,
      });
      if (!update) return false;

      await this.queueService.enqueueSystemJob(
        NAVIGATION_ROUTE_UPDATE_DELIVERY_JOB,
        { updateId: update.id },
        {
          jobId: `navigation-route-update-${update.id}`,
          attempts: 5,
          backoffMs: 1_000,
        },
      );
      return true;
    } catch (error) {
      this.logger.error(
        { incidentId, sessionId: session.id, failure: true },
        error instanceof Error ? error.stack : undefined,
        'NavigationService.evaluateSession',
      );
      return false;
    }
  }

  private findMeaningfulAlternative(
    routes: RoutePreviewRoute[],
    session: NavigationSessionRecord,
    currentRiskScore: number,
  ): RoutePreviewRoute | null {
    return (
      routes
        .filter((route) => route.id !== session.routeFingerprint)
        .filter((route) => route.risk.riskScore <= currentRiskScore - this.minimumRiskImprovement)
        .filter(
          (route) =>
            route.durationSeconds <=
            session.routeDurationSeconds * (1 + this.maximumDurationOverheadRatio),
        )
        .sort(
          (a, b) =>
            Number(b.recommended) - Number(a.recommended) ||
            a.risk.riskScore - b.risk.riskScore ||
            a.durationSeconds - b.durationSeconds ||
            a.distanceMeters - b.distanceMeters ||
            a.id.localeCompare(b.id),
        )[0] ?? null
    );
  }

  private toResponse(session: NavigationSessionRecord) {
    return {
      id: session.id,
      routeId: session.routeFingerprint,
      routeGeometry: session.routeGeometry,
      origin: session.origin,
      destination: session.destination,
      travelMode: session.travelMode,
      status: session.status,
      startedAt: session.startedAt,
      lastRouteUpdateAt: session.lastRouteUpdateAt,
      expiresAt: session.expiresAt,
      route: {
        distanceMeters: session.routeDistanceMeters,
        durationSeconds: session.routeDurationSeconds,
      },
      currentRisk: {
        riskScore: session.currentRiskScore,
        riskLevel: session.currentRiskLevel,
        affectingIncidentCount: session.currentAffectingIncidentCount,
        severeIncidentCount: session.currentSevereIncidentCount,
      },
      updates: session.updates.map((update) => ({
        id: update.id,
        triggeringIncidentId: update.triggeringIncidentId,
        previousRouteFingerprint: update.previousRouteFingerprint,
        newRouteFingerprint: update.newRouteFingerprint,
        previousRiskScore: update.previousRiskScore,
        newRiskScore: update.newRiskScore,
        reason: update.reason,
        route: update.route,
        status: update.status,
        createdAt: update.createdAt,
        sentAt: update.sentAt,
      })),
    };
  }

  private validateGeometry(geometry: RouteLineString): void {
    if (geometry.type !== 'LineString' || geometry.coordinates.length < 2) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'route.geometry must be a LineString with at least two coordinates',
      );
    }
    for (const [index, point] of geometry.coordinates.entries()) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        point[0] < -180 ||
        point[0] > 180 ||
        point[1] < -90 ||
        point[1] > 90
      ) {
        throw new ApplicationError(
          ErrorCodes.ValidationError,
          `route.geometry.coordinates[${index}] must be [longitude, latitude]`,
        );
      }
    }
  }

  private validateCoordinate(
    coordinate: { longitude: number; latitude: number },
    name: string,
  ): void {
    if (
      !Number.isFinite(coordinate.longitude) ||
      coordinate.longitude < -180 ||
      coordinate.longitude > 180
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${name}.longitude is invalid`);
    }
    if (
      !Number.isFinite(coordinate.latitude) ||
      coordinate.latitude < -90 ||
      coordinate.latitude > 90
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${name}.latitude is invalid`);
    }
  }

  private fingerprint(input: NavigationSessionStartInput): string {
    return createHash('sha256').update(JSON.stringify(input.route.geometry)).digest('hex');
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}

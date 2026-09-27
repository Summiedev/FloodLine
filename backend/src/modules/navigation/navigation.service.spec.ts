import { NotFoundException } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { TravelMode } from '../routing/routing.types';
import type { NavigationRouteUpdateRecord, NavigationSessionRecord } from './navigation.types';

const userId = '10000000-0000-4000-8000-000000000001';
const sessionId = '10000000-0000-4000-8000-000000000002';
const incidentId = '10000000-0000-4000-8000-000000000003';

const geometry = {
  type: 'LineString' as const,
  coordinates: [[3.4, 6.4] as [number, number], [3.5, 6.5] as [number, number]],
};

function risk(overrides: Record<string, unknown> = {}) {
  return {
    riskScore: 0,
    riskLevel: 'LOW' as const,
    affectingIncidentCount: 0,
    severeIncidentCount: 0,
    avoidedIncidentCount: null,
    incidents: [],
    summary: 'No currently known reports' as const,
    ...overrides,
  };
}

function session(overrides: Partial<NavigationSessionRecord> = {}): NavigationSessionRecord {
  return {
    id: sessionId,
    userId,
    routeFingerprint: 'current-route',
    routeGeometry: geometry,
    origin: { longitude: 3.4, latitude: 6.4 },
    destination: { longitude: 3.5, latitude: 6.5 },
    travelMode: TravelMode.DRIVING,
    routeDistanceMeters: 10_000,
    routeDurationSeconds: 1_800,
    currentRiskScore: 0,
    currentRiskLevel: 'LOW',
    currentAffectingIncidentCount: 0,
    currentSevereIncidentCount: 0,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    status: 'ACTIVE',
    startedAt: new Date('2026-09-27T10:00:00.000Z'),
    lastRouteUpdateAt: new Date('2026-09-27T10:00:00.000Z'),
    lastReroutedAt: null,
    updates: [],
    ...overrides,
  };
}

function alternative() {
  return {
    id: 'lower-risk-route',
    routeId: 'lower-risk-route',
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [3.4, 6.4] as [number, number],
        [3.45, 6.45] as [number, number],
        [3.5, 6.5] as [number, number],
      ],
    },
    polyline: null,
    distanceMeters: 11_000,
    durationSeconds: 1_900,
    travelMode: TravelMode.DRIVING,
    risk: risk({
      riskScore: 0.1,
      affectingIncidentCount: 0,
      summary: 'Lower reported flood risk' as const,
    }),
    recommended: true,
    recommendationReason: 'LOWER_REPORTED_FLOOD_RISK' as const,
  };
}

function createHarness() {
  const repository = {
    create: jest.fn().mockResolvedValue(session()),
    findOwnedById: jest.fn().mockResolvedValue(session()),
    cancelOwned: jest.fn().mockResolvedValue(true),
    findAffectedActiveSessions: jest.fn().mockResolvedValue([]),
    updateCurrentRisk: jest.fn().mockResolvedValue(undefined),
    applyRouteUpdate: jest.fn().mockResolvedValue(null),
    findRouteUpdateForDelivery: jest.fn(),
    markRouteUpdateSent: jest.fn(),
    markRouteUpdateFailed: jest.fn(),
    expireDue: jest.fn().mockResolvedValue(0),
  };
  const routeRiskService = { evaluate: jest.fn().mockResolvedValue(risk()) };
  const routingService = { preview: jest.fn().mockResolvedValue({ routes: [] }) };
  const queueService = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
  const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  const transport = { publish: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'navigation.sessionTtlMinutes': 120,
        'navigation.rerouteCooldownSeconds': 300,
        'navigation.minimumRiskImprovement': 0.1,
        'navigation.maximumDurationOverheadRatio': 0.5,
        'navigation.evaluationBatchSize': 100,
        'routeRisk.corridorMeters': 250,
      };
      return values[key];
    }),
  };
  return {
    service: new NavigationService(
      repository as never,
      routeRiskService as never,
      routingService as never,
      queueService as never,
      logger as never,
      transport,
      config as never,
    ),
    repository,
    routeRiskService,
    routingService,
    queueService,
    transport,
  };
}

describe('NavigationService', () => {
  it('starts a session with server-calculated route risk', async () => {
    const harness = createHarness();
    harness.routeRiskService.evaluate.mockResolvedValue(
      risk({ riskScore: 0.4, riskLevel: 'MODERATE', affectingIncidentCount: 2 }),
    );
    harness.repository.create.mockImplementation((input: NavigationSessionRecord) =>
      Promise.resolve(
        session({
          currentRiskScore: input.currentRiskScore,
          currentRiskLevel: input.currentRiskLevel,
          currentAffectingIncidentCount: input.currentAffectingIncidentCount,
          currentSevereIncidentCount: input.currentSevereIncidentCount,
        }),
      ),
    );

    const result = await harness.service.start(userId, {
      origin: { longitude: 3.4, latitude: 6.4 },
      destination: { longitude: 3.5, latitude: 6.5 },
      travelMode: TravelMode.DRIVING,
      route: { id: 'chosen-route', geometry, distanceMeters: 10_000, durationSeconds: 1_800 },
    });

    expect(result.currentRisk).toMatchObject({ riskScore: 0.4, affectingIncidentCount: 2 });
    expect(harness.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        routeFingerprint: 'chosen-route',
        currentRiskScore: 0.4,
        currentAffectingIncidentCount: 2,
      }),
    );
  });

  it('enforces ownership for session reads', async () => {
    const harness = createHarness();
    harness.repository.findOwnedById.mockResolvedValue(null);

    await expect(harness.service.findOwned(userId, sessionId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reroutes an affected session only when a meaningful lower-risk alternative exists', async () => {
    const harness = createHarness();
    harness.repository.findAffectedActiveSessions
      .mockResolvedValueOnce([session()])
      .mockResolvedValueOnce([]);
    harness.routeRiskService.evaluate.mockResolvedValue(
      risk({
        riskScore: 0.8,
        riskLevel: 'HIGH',
        affectingIncidentCount: 2,
        severeIncidentCount: 1,
        summary: 'Flood reports detected',
      }),
    );
    harness.routingService.preview.mockResolvedValue({ routes: [alternative()] });
    const update = { id: '10000000-0000-4000-8000-000000000004' } as NavigationRouteUpdateRecord;
    harness.repository.applyRouteUpdate.mockResolvedValue(update);

    await expect(harness.service.evaluateIncidentImpact(incidentId)).resolves.toBe(1);
    expect(harness.repository.applyRouteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        triggeringIncidentId: incidentId,
        route: alternative(),
      }),
    );
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'navigation.route-update-delivery',
      { updateId: update.id },
      expect.anything(),
    );
  });

  it('does not reroute unaffected sessions or sessions inside cooldown', async () => {
    const harness = createHarness();
    harness.repository.findAffectedActiveSessions.mockResolvedValue([]);
    await expect(harness.service.evaluateIncidentImpact(incidentId)).resolves.toBe(0);
    expect(harness.routingService.preview).not.toHaveBeenCalled();

    harness.repository.findAffectedActiveSessions
      .mockResolvedValueOnce([session({ lastReroutedAt: new Date() })])
      .mockResolvedValueOnce([]);
    await expect(harness.service.evaluateIncidentImpact(incidentId)).resolves.toBe(0);
    expect(harness.repository.applyRouteUpdate).not.toHaveBeenCalled();
  });

  it('handles a provider failure without changing the session route', async () => {
    const harness = createHarness();
    harness.repository.findAffectedActiveSessions
      .mockResolvedValueOnce([session()])
      .mockResolvedValueOnce([]);
    harness.routeRiskService.evaluate.mockResolvedValue(
      risk({ riskScore: 0.8, riskLevel: 'HIGH' }),
    );
    harness.routingService.preview.mockRejectedValue(new Error('provider unavailable'));

    await expect(harness.service.evaluateIncidentImpact(incidentId)).resolves.toBe(0);
    expect(harness.repository.applyRouteUpdate).not.toHaveBeenCalled();
    expect(harness.repository.updateCurrentRisk).toHaveBeenCalled();
  });

  it('expires stale sessions through the scheduled job seam', async () => {
    const harness = createHarness();
    harness.repository.expireDue.mockResolvedValue(3);

    await expect(harness.service.expireStaleSessions()).resolves.toBe(3);
    expect(harness.repository.expireDue).toHaveBeenCalledTimes(1);
  });

  it('publishes route updates and records transport failures', async () => {
    const harness = createHarness();
    const update = {
      id: '10000000-0000-4000-8000-000000000004',
      userId,
      sessionId,
      triggeringIncidentId: incidentId,
      triggeringIncidentLocationName: 'Test road',
      status: 'PENDING',
      route: alternative(),
    } as unknown as NavigationRouteUpdateRecord;
    harness.repository.findRouteUpdateForDelivery.mockResolvedValue(update);

    await harness.service.deliverRouteUpdate(update.id);
    expect(harness.transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Avoiding reported flooding on Test road' }),
    );
    expect(harness.repository.markRouteUpdateSent).toHaveBeenCalledWith(update.id);

    harness.transport.publish.mockRejectedValue(new Error('transport unavailable'));
    await expect(harness.service.deliverRouteUpdate(update.id)).rejects.toThrow(
      'transport unavailable',
    );
    expect(harness.repository.markRouteUpdateFailed).toHaveBeenCalledWith(
      update.id,
      'transport unavailable',
    );
  });
});

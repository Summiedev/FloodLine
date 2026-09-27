import { IncidentSeverity } from '@prisma/client';
import { RouteRiskService } from './route-risk.service';
import type { RouteLineString } from './routing.types';

const geometry: RouteLineString = {
  type: 'LineString',
  coordinates: [
    [3.4, 6.4],
    [3.5, 6.5],
  ],
};

function createHarness() {
  const repository = { findActiveIncidentsNearRoute: jest.fn().mockResolvedValue([]) };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'routeRisk.corridorMeters': 250,
        'routeRisk.recentWindowHours': 72,
        'routeRisk.lowThreshold': 0.3,
        'routeRisk.highThreshold': 0.7,
      };
      return values[key];
    }),
  };
  return { service: new RouteRiskService(repository as never, config as never), repository };
}

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    incidentType: 'SEVERE_FLOODING',
    severity: IncidentSeverity.SEVERE,
    confidenceLabel: 'HIGH',
    sourceType: 'COMMUNITY',
    locationName: 'Test road',
    distanceMeters: 0,
    updatedAt: new Date('2026-09-26T12:00:00.000Z'),
    ...overrides,
  };
}

describe('RouteRiskService', () => {
  it('returns no-currently-known-reports for an empty active-incident result', async () => {
    const harness = createHarness();

    await expect(
      harness.service.evaluate(geometry, new Date('2026-09-26T12:10:00.000Z')),
    ).resolves.toMatchObject({
      riskScore: 0,
      riskLevel: 'LOW',
      affectingIncidentCount: 0,
      severeIncidentCount: 0,
      summary: 'No currently known reports',
      avoidedIncidentCount: null,
    });
    expect(harness.repository.findActiveIncidentsNearRoute).toHaveBeenCalledWith(geometry, 250);
  });

  it('weights a recent severe incident directly on the route as high risk', async () => {
    const harness = createHarness();
    harness.repository.findActiveIncidentsNearRoute.mockResolvedValue([incident()]);

    await expect(
      harness.service.evaluate(geometry, new Date('2026-09-26T12:10:00.000Z')),
    ).resolves.toMatchObject({
      riskScore: 0.998,
      riskLevel: 'HIGH',
      affectingIncidentCount: 1,
      severeIncidentCount: 1,
      summary: 'Flood reports detected',
    });
  });

  it('reduces moderate, lower-confidence, farther and older evidence deterministically', async () => {
    const harness = createHarness();
    harness.repository.findActiveIncidentsNearRoute.mockResolvedValue([
      incident({
        severity: IncidentSeverity.MODERATE,
        confidenceLabel: 'LOW',
        distanceMeters: 200,
        updatedAt: new Date('2026-09-25T12:00:00.000Z'),
      }),
    ]);

    await expect(
      harness.service.evaluate(geometry, new Date('2026-09-26T12:00:00.000Z')),
    ).resolves.toMatchObject({
      riskScore: 0.022,
      riskLevel: 'LOW',
      affectingIncidentCount: 1,
      severeIncidentCount: 0,
      summary: 'Lower reported flood risk',
    });
  });

  it('ignores incidents outside the configured corridor when PostGIS returns no match', async () => {
    const harness = createHarness();
    harness.repository.findActiveIncidentsNearRoute.mockResolvedValue([]);

    await expect(harness.service.evaluate(geometry)).resolves.toMatchObject({
      affectingIncidentCount: 0,
      severeIncidentCount: 0,
      riskScore: 0,
      summary: 'No currently known reports',
    });
  });

  it('aggregates multiple incidents and gives official evidence its configured weight', async () => {
    const harness = createHarness();
    harness.repository.findActiveIncidentsNearRoute.mockResolvedValue([
      incident({ id: '10000000-0000-4000-8000-000000000002', distanceMeters: 100 }),
      incident({
        id: '10000000-0000-4000-8000-000000000003',
        severity: IncidentSeverity.MODERATE,
        sourceType: 'OFFICIAL',
        distanceMeters: 0,
      }),
    ]);

    const result = await harness.service.evaluate(geometry, new Date('2026-09-26T12:10:00.000Z'));
    expect(result.affectingIncidentCount).toBe(2);
    expect(result.severeIncidentCount).toBe(1);
    expect(result.riskScore).toBeGreaterThan(0.7);
    expect(result.incidents[0]?.distanceMeters).toBe(100);
  });
});

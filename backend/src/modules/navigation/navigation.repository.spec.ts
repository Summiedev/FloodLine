import { NavigationRepository } from './navigation.repository';
import { TravelMode } from '../routing/routing.types';

describe('NavigationRepository', () => {
  it('matches active sessions with PostGIS corridor predicates and batches by ID', async () => {
    let capturedQuery: { sql: string } | undefined;
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: { sql: string }) => {
        capturedQuery = query;
        return Promise.resolve([]);
      }),
    };
    const repository = new NavigationRepository(prisma as never);

    await repository.findAffectedActiveSessions(
      '10000000-0000-4000-8000-000000000001',
      250,
      100,
      '10000000-0000-4000-8000-000000000002',
    );

    const query = capturedQuery as { sql: string };
    expect(query.sql).toContain('ST_DWithin');
    expect(query.sql).toContain('route_geometry');
    expect(query.sql).toContain('NavigationSessionStatus');
    expect(query.sql).toContain('expires_at');
    expect(query.sql).toContain('LIMIT');
    expect(query.sql).toContain('id"::text >');
  });

  it('uses a row lock, cooldown predicate, and unique incident key for reroute updates', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          { userId: '10000000-0000-4000-8000-000000000001', lastReroutedAt: null },
        ])
        .mockResolvedValueOnce([{ id: '10000000-0000-4000-8000-000000000004' }])
        .mockResolvedValueOnce([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback: (transaction: unknown) => unknown) =>
      callback(prisma),
    );
    const repository = new NavigationRepository(prisma as never);

    await repository.applyRouteUpdate({
      sessionId: '10000000-0000-4000-8000-000000000001',
      triggeringIncidentId: '10000000-0000-4000-8000-000000000002',
      previousRouteFingerprint: 'old',
      previousRiskScore: 0.8,
      route: {
        id: 'new',
        routeId: 'new',
        geometry: {
          type: 'LineString',
          coordinates: [
            [3.4, 6.4],
            [3.5, 6.5],
          ],
        },
        polyline: null,
        distanceMeters: 10,
        durationSeconds: 100,
        travelMode: TravelMode.DRIVING,
        risk: {
          riskScore: 0.1,
          riskLevel: 'LOW',
          affectingIncidentCount: 0,
          severeIncidentCount: 0,
          avoidedIncidentCount: 2,
          incidents: [],
          summary: 'Lower reported flood risk',
        },
        recommended: true,
        recommendationReason: 'LOWER_REPORTED_FLOOD_RISK',
      },
      reason: 'LOWER_REPORTED_FLOOD_RISK',
      cooldownSeconds: 300,
    });

    const queryText = (prisma.$queryRaw.mock.calls as unknown[][])
      .map((call) => (call[0] as { sql: string }).sql)
      .join('\n');
    expect(queryText).toContain('FOR UPDATE');
    expect(queryText).toContain('ON CONFLICT');
    expect(queryText).toContain('last_rerouted_at');
  });
});

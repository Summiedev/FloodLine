import { RouteRiskRepository } from './route-risk.repository';
import type { RouteLineString } from './routing.types';

describe('RouteRiskRepository', () => {
  it('uses a PostGIS route corridor and active/non-expired predicates', async () => {
    const prisma = { $queryRaw: jest.fn().mockImplementation((query: unknown) => query) };
    const repository = new RouteRiskRepository(prisma as never);
    const geometry: RouteLineString = {
      type: 'LineString',
      coordinates: [
        [3.4, 6.4],
        [3.5, 6.5],
      ],
    };

    await repository.findActiveIncidentsNearRoute(geometry, 250);

    const query = (prisma.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ST_DWithin');
    expect(query.sql).toContain('affected_geometry');
    expect(query.sql).toContain('IncidentStatus');
    expect(query.sql).toContain('expires_at');
    expect(query.sql).toContain('ST_Distance');
  });
});

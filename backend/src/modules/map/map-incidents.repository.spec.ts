import { MapIncidentsRepository } from './map-incidents.repository';

describe('MapIncidentsRepository', () => {
  it('uses GiST-friendly envelope intersections and a bounded SQL limit', async () => {
    const prisma = { $queryRaw: jest.fn().mockImplementation((query: unknown) => query) };
    const repository = new MapIncidentsRepository(prisma as never);

    await repository.findMarkers({
      west: 3.2,
      south: 6.3,
      east: 3.6,
      north: 6.6,
      limit: 200,
    });

    const query = (prisma.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ST_MakeEnvelope');
    expect(query.sql).toContain('ST_Intersects');
    expect(query.sql).toContain('LIMIT');
    expect(query.sql).toContain('expires_at');
  });

  it('emits two envelopes for a date-line crossing viewport', async () => {
    const prisma = { $queryRaw: jest.fn().mockImplementation((query: unknown) => query) };
    const repository = new MapIncidentsRepository(prisma as never);

    await repository.findMarkers({
      west: 170,
      south: -10,
      east: -170,
      north: 10,
      limit: 100,
    });

    const query = (prisma.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect((query.sql.match(/ST_MakeEnvelope/g) ?? []).length).toBe(4);
    expect(query.sql).toContain('OR');
  });
});

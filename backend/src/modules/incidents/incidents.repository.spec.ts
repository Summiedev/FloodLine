import { IncidentStatus } from '@prisma/client';
import { IncidentsRepository } from './incidents.repository';

describe('IncidentsRepository geospatial queries', () => {
  it('uses ST_DWithin for radius searches and orders by distance', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: unknown) => query),
      $transaction: jest.fn().mockResolvedValue([[{ count: 0n }], []]),
    };
    const repository = new IncidentsRepository(prisma as never);

    await repository.findMany({
      center: { longitude: 3.4, latitude: 6.4, radiusMeters: 5_000 },
      page: 1,
      pageSize: 20,
    });

    const calls = prisma.$transaction.mock.calls as unknown[][];
    const queries = calls[0]?.[0] as Array<{ sql: string }>;
    const queryText = queries.map((query) => query.sql).join('\n');
    expect(queryText).toContain('ST_DWithin');
    expect(queryText).toContain('ST_Distance');
    expect(queryText).toContain('CURRENT_TIMESTAMP');
  });

  it('uses ST_Intersects with an envelope for bounding-box searches', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: unknown) => query),
      $transaction: jest.fn().mockResolvedValue([[{ count: 0n }], []]),
    };
    const repository = new IncidentsRepository(prisma as never);

    await repository.findMany({
      bbox: { west: 3.2, south: 6.3, east: 3.6, north: 6.6 },
      status: IncidentStatus.EXPIRED,
      page: 1,
      pageSize: 20,
    });

    const calls = prisma.$transaction.mock.calls as unknown[][];
    const queries = calls[0]?.[0] as Array<{ sql: string }>;
    const queryText = queries.map((query) => query.sql).join('\n');
    expect(queryText).toContain('ST_Intersects');
    expect(queryText).toContain('ST_MakeEnvelope');
    expect(queryText).toContain('IncidentStatus');
  });
});

import { SavedPlacesRepository } from './saved-places.repository';

describe('SavedPlacesRepository geospatial queries', () => {
  it('uses PostGIS point and affected-geometry proximity operations', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: unknown) => query),
    };
    const repository = new SavedPlacesRepository(prisma as never);

    await repository.findWithinIncidentRadius('10000000-0000-4000-8000-000000000001', 500);

    const calls = prisma.$queryRaw.mock.calls as unknown[][];
    const query = calls[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ST_DWithin');
    expect(query.sql).toContain('affected_geometry');
    expect(query.sql).toContain('saved_places');
    expect(query.sql).toContain('is_active');
  });

  it('scopes list queries by user and keeps pagination database-side', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: unknown) => query),
      $transaction: jest.fn().mockResolvedValue([[{ count: 0n }], []]),
    };
    const repository = new SavedPlacesRepository(prisma as never);

    await repository.findManyByUser({
      userId: '10000000-0000-4000-8000-000000000001',
      page: 2,
      pageSize: 20,
    });

    const calls = prisma.$transaction.mock.calls as unknown[][];
    const queries = calls[0]?.[0] as Array<{ sql: string }>;
    const queryText = queries.map((query) => query.sql).join('\n');
    expect(queryText).toContain('user_id');
    expect(queryText).toContain('LIMIT');
    expect(queryText).toContain('OFFSET');
  });
});

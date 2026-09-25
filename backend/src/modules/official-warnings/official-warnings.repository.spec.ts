import { OfficialWarningsRepository } from './official-warnings.repository';

describe('OfficialWarningsRepository geospatial and identity queries', () => {
  it('uses affected-area ST_DWithin for radius filtering', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation((query: unknown) => query),
      $transaction: jest.fn().mockResolvedValue([[{ count: 0n }], []]),
    };
    const repository = new OfficialWarningsRepository(prisma as never);

    await repository.findMany({
      active: true,
      longitude: 3.4,
      latitude: 6.4,
      radiusMeters: 5_000,
      page: 1,
      pageSize: 20,
    });

    const calls = prisma.$transaction.mock.calls as unknown[][];
    const queries = calls[0]?.[0] as Array<{ sql: string }>;
    const queryText = queries.map((query) => query.sql).join('\n');
    expect(queryText).toContain('ST_DWithin');
    expect(queryText).toContain('affected_geometry');
    expect(queryText).toContain('OfficialWarningStatus');
  });

  it('uses provider and external ID as the idempotency key', async () => {
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'warning-1', inserted: true }])
        .mockResolvedValueOnce([]),
    };
    const repository = new OfficialWarningsRepository({} as never);
    const input = {
      authority: 'authority-example',
      externalId: 'external-1',
      title: 'Warning',
      description: 'Description',
      severity: 'HIGH',
      status: 'ACTIVE',
      affectedGeometry: { type: 'Point', coordinates: [3.4, 6.4] },
      issuedAt: new Date(),
      effectiveAt: new Date(),
      expiresAt: null,
      sourceUrl: null,
      rawProviderMetadata: null,
    };
    // The identity read-back is intentionally not exercised here; this test
    // verifies the generated upsert statement's conflict target.
    await expect(
      repository.upsertWithinTransaction(transaction as never, input as never),
    ).rejects.toThrow('Official warning was written but could not be read back');
    const calls = transaction.$queryRaw.mock.calls as unknown[][];
    const query = calls[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ON CONFLICT');
    expect(query.sql).toContain('authority');
    expect(query.sql).toContain('external_id');
  });
});

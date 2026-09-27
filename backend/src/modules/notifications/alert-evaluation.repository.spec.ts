import { AlertEvaluationRepository } from './alert-evaluation.repository';

describe('AlertEvaluationRepository', () => {
  it('uses PostGIS distance predicates, saved-place preference radius, and database batching', async () => {
    const prisma = { $queryRaw: jest.fn().mockImplementation((query: unknown) => query) };
    const repository = new AlertEvaluationRepository(prisma as never);

    await repository.findIncidentTargets('10000000-0000-4000-8000-000000000001', 3_500, 250);

    const query = (prisma.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ST_DWithin');
    expect(query.sql).toContain('alert_preferences');
    expect(query.sql).toContain('DISTINCT ON');
    expect(query.sql).toContain('LIMIT');
    expect(query.sql).toContain('enabledChannels');
  });

  it('matches official warning affected geometry and supports a cursor for batches', async () => {
    const prisma = { $queryRaw: jest.fn().mockImplementation((query: unknown) => query) };
    const repository = new AlertEvaluationRepository(prisma as never);

    await repository.findOfficialWarningTargets(
      '10000000-0000-4000-8000-000000000002',
      1_000,
      100,
      '10000000-0000-4000-8000-000000000010',
    );

    const query = (prisma.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('affected_geometry');
    expect(query.sql).toContain('sp."user_id" >');
    expect(query.sql).toContain('NotificationType');
  });
});

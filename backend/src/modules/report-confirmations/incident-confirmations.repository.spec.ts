import { IncidentStatus } from '@prisma/client';
import { IncidentConfirmationsRepository } from './incident-confirmations.repository';

describe('IncidentConfirmationsRepository concurrency safeguards', () => {
  it('locks the incident row before evaluating confirmation state', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000010',
          status: IncidentStatus.ACTIVE,
          expiresAt: null,
          databaseNow: new Date(),
        },
      ]),
    };
    const repository = new IncidentConfirmationsRepository({} as never);

    await repository.lockIncident(transaction as never, '10000000-0000-4000-8000-000000000010');

    const query = (transaction.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('FOR UPDATE');
  });

  it('recalculates counts from confirmation rows instead of accepting a client count', async () => {
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ confirmationCount: 2, lastConfirmedAt: new Date() }]),
    };
    const repository = new IncidentConfirmationsRepository({} as never);

    await repository.recalculateIncidentAggregate(
      transaction as never,
      '10000000-0000-4000-8000-000000000010',
    );

    const query = (transaction.$queryRaw.mock.calls as unknown[][])[0]?.[0] as { sql: string };
    expect(query.sql).toContain('COUNT(*)');
    expect(query.sql).toContain('UPDATE "incidents"');
  });
});

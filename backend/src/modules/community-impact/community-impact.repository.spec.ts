import { CommunityImpactRepository } from './community-impact.repository';

describe('CommunityImpactRepository', () => {
  it('derives metrics from source records and deduplicates recipients by incident', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          reportsSubmitted: 2,
          confirmationsMade: 3,
          peopleHelped: 7,
          alertRecipientsFromContributedIncidents: 9,
        },
      ]),
    };
    const repository = new CommunityImpactRepository(prisma as never);

    await expect(repository.getForUser('10000000-0000-4000-8000-000000000001')).resolves.toEqual({
      reportsSubmitted: 2,
      confirmationsMade: 3,
      peopleHelped: 7,
      alertRecipientsFromContributedIncidents: 9,
    });
    const query = (prisma.$queryRaw.mock.calls[0] as unknown[])[0] as { sql: string };
    expect(query.sql).toContain('REJECTED');
    expect(query.sql).toContain('COUNT(DISTINCT (n."incident_id", n."user_id"))');
    expect(query.sql).toContain('contributed_incidents');
  });
});

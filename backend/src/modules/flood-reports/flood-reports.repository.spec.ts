import { IncidentType } from '@prisma/client';
import { FloodReportsRepository } from './flood-reports.repository';

describe('FloodReportsRepository geospatial report queries', () => {
  it('uses PostGIS for duplicate and compatible-incident checks', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const repository = new FloodReportsRepository({} as never);
    const record = {
      reporterUserId: '10000000-0000-4000-8000-000000000001',
      reportType: IncidentType.SEVERE_FLOODING,
      longitude: 3.4,
      latitude: 6.4,
    };

    await repository.findRecentDuplicate(transaction as never, record, 60, 50);
    await repository.findCompatibleIncident(
      transaction as never,
      IncidentType.SEVERE_FLOODING,
      3.4,
      6.4,
      120,
      500,
    );

    const queryText = (transaction.$queryRaw.mock.calls as Array<unknown[]>)
      .map(([query]) => (query as { sql: string }).sql)
      .join('\n');
    expect(queryText).toContain('ST_DWithin');
    expect(queryText).toContain('CURRENT_TIMESTAMP');
    expect(queryText).toContain('IncidentType');
  });
});

import { AlertPreferencesRepository } from './alert-preferences.repository';

describe('AlertPreferencesRepository', () => {
  it('uses an atomic default-profile upsert and stores enum arrays', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000001',
          userId: '10000000-0000-4000-8000-000000000002',
          savedPlaceId: null,
          radiusMeters: 3_500,
          incidentTypes: ['SEVERE_FLOODING'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    const repository = new AlertPreferencesRepository(prisma as never);

    await repository.upsertDefault('10000000-0000-4000-8000-000000000002', 3_500, [
      'SEVERE_FLOODING',
      'MODERATE_FLOODING',
    ]);

    const calls = prisma.$queryRaw.mock.calls as unknown[][];
    const query = calls[0]?.[0] as { sql: string };
    expect(query.sql).toContain('ON CONFLICT');
    expect(query.sql).toContain('saved_place_id');
    expect(query.sql).toContain('incident_types');
    expect(query.sql).toContain('IncidentType');
  });

  it('supports default fallback or a future place-specific preference', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const repository = new AlertPreferencesRepository(prisma as never);

    await repository.findEffective(
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
    );

    const calls = prisma.$queryRaw.mock.calls as unknown[][];
    const query = calls[0]?.[0] as { sql: string };
    expect(query.sql).toContain('saved_place_id');
    expect(query.sql).toContain('ORDER BY');
  });
});

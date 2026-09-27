import type { IncidentType } from '@prisma/client';
import type { AlertPreferencesRepository } from './alert-preferences.repository';
import { AlertPreferencesService } from './alert-preferences.service';
import type { AlertPreferenceRecord } from './alert-preference.types';

const userId = '10000000-0000-4000-8000-000000000001';

function config() {
  const values: Record<string, number> = {
    'alertPreference.minimumRadiusMeters': 500,
    'alertPreference.maximumRadiusMeters': 100_000,
    'alertPreference.defaultRadiusMeters': 1_000,
  };
  return { getOrThrow: jest.fn((key: string) => values[key]) };
}

function preference(overrides: Partial<AlertPreferenceRecord> = {}): AlertPreferenceRecord {
  return {
    id: '10000000-0000-4000-8000-000000000002',
    userId,
    savedPlaceId: null,
    radiusMeters: 1_000,
    incidentTypes: ['SEVERE_FLOODING', 'MODERATE_FLOODING', 'BLOCKED_ROAD', 'BLOCKED_DRAIN'],
    createdAt: new Date('2026-09-25T08:00:00.000Z'),
    updatedAt: new Date('2026-09-25T08:00:00.000Z'),
    ...overrides,
  };
}

function createService(current: AlertPreferenceRecord | null = preference()) {
  const repositoryMock = {
    ensureDefault: jest.fn().mockResolvedValue(current ?? preference()),
    findDefault: jest.fn().mockResolvedValue(current),
    upsertDefault: jest.fn().mockResolvedValue(current ?? preference()),
    findEffective: jest.fn().mockResolvedValue(current),
  };
  return {
    service: new AlertPreferencesService(
      config() as never,
      repositoryMock as unknown as AlertPreferencesRepository,
    ),
    repositoryMock,
  };
}

describe('AlertPreferencesService', () => {
  it('creates sensible default preferences for a new user', async () => {
    const harness = createService(null);

    const result = await harness.service.getDefault(userId);

    expect(harness.repositoryMock.ensureDefault).toHaveBeenCalledWith(userId, 1_000, [
      'SEVERE_FLOODING',
      'MODERATE_FLOODING',
      'BLOCKED_ROAD',
      'BLOCKED_DRAIN',
    ]);
    expect(result.radiusMeters).toBe(1_000);
    expect(result.incidentTypes).toContain('SEVERE_FLOODING');
  });

  it('stores actual numeric radius values such as 3500 meters', async () => {
    const harness = createService();

    await harness.service.updateDefault(userId, { radiusMeters: 3_500 });

    expect(harness.repositoryMock.upsertDefault).toHaveBeenCalledWith(userId, 3_500, [
      'SEVERE_FLOODING',
      'MODERATE_FLOODING',
      'BLOCKED_ROAD',
      'BLOCKED_DRAIN',
    ]);
  });

  it('forces severe flooding to remain enabled when the client omits it', async () => {
    const harness = createService();

    await harness.service.updateDefault(userId, {
      incidentTypes: ['MODERATE_FLOODING', 'BLOCKED_ROAD'] as IncidentType[],
    });

    expect(harness.repositoryMock.upsertDefault).toHaveBeenCalledWith(userId, 1_000, [
      'SEVERE_FLOODING',
      'MODERATE_FLOODING',
      'BLOCKED_ROAD',
    ]);
  });

  it('rejects radii outside configured product bounds', async () => {
    const harness = createService();

    await expect(harness.service.updateDefault(userId, { radiusMeters: 499 })).rejects.toThrow(
      'radiusMeters must be between 500 and 100000',
    );
    await expect(harness.service.updateDefault(userId, { radiusMeters: 100_001 })).rejects.toThrow(
      'radiusMeters must be between 500 and 100000',
    );
  });

  it('rejects unsupported incident types before persistence', async () => {
    const harness = createService();

    await expect(
      harness.service.updateDefault(userId, {
        incidentTypes: ['SEVERE_FLOODING', 'UNSUPPORTED_TYPE'] as IncidentType[],
      }),
    ).rejects.toThrow('unsupported incident type');
    expect(harness.repositoryMock.upsertDefault).not.toHaveBeenCalled();
  });

  it('exposes effective preference lookup for future per-place overrides', async () => {
    const harness = createService();
    const savedPlaceId = '10000000-0000-4000-8000-000000000003';

    await harness.service.getForAlertEvaluation(userId, savedPlaceId);

    expect(harness.repositoryMock.findEffective).toHaveBeenCalledWith(userId, savedPlaceId);
  });
});

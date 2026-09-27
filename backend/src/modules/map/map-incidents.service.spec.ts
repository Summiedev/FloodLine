import { ApplicationError } from '../../common/errors/application.error';
import { MapIncidentsService } from './map-incidents.service';

function query(overrides: Record<string, unknown> = {}) {
  return {
    north: 6.6,
    south: 6.3,
    east: 3.6,
    west: 3.2,
    limit: 200,
    ...overrides,
  } as never;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    longitude: 3.4,
    latitude: 6.4,
    incidentType: 'SEVERE_FLOODING',
    severity: 'SEVERE',
    confidenceLabel: 'HIGH',
    status: 'ACTIVE',
    updatedAt: new Date('2026-09-26T08:00:00.000Z'),
    ...overrides,
  };
}

describe('MapIncidentsService', () => {
  it('returns a bounded marker-only response and an incremental cursor', async () => {
    const repository = { findMarkers: jest.fn().mockResolvedValue([row()]) };
    const service = new MapIncidentsService(repository as never);

    const response = await service.getFeed(query({ limit: 1 }));

    expect(response.data[0]).toMatchObject({
      id: row().id,
      coordinates: { longitude: 3.4, latitude: 6.4, srid: 4326 },
      clustered: false,
      pointCount: 1,
    });
    expect(response.data[0]).not.toHaveProperty('description');
    expect(response.meta.nextUpdatedSince).toBe('2026-09-26T08:00:00.000Z');
  });

  it('accepts international-date-line crossing bounds', async () => {
    const repository = { findMarkers: jest.fn().mockResolvedValue([]) };
    const service = new MapIncidentsService(repository as never);

    const response = await service.getFeed(query({ west: 170, east: -170 }));

    expect(response.meta.datelineCrossing).toBe(true);
  });

  it('rejects zero-width and inverted latitude bounds', async () => {
    const service = new MapIncidentsService({ findMarkers: jest.fn() } as never);

    await expect(service.getFeed(query({ west: 3.4, east: 3.4 }))).rejects.toBeInstanceOf(
      ApplicationError,
    );
    await expect(service.getFeed(query({ south: 7, north: 6 }))).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });
});

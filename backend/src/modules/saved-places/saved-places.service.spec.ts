import type { SavedPlaceType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { SavedPlacesRepository } from './saved-places.repository';
import { SavedPlacesService } from './saved-places.service';

const userId = '10000000-0000-4000-8000-000000000001';
const otherUserId = '10000000-0000-4000-8000-000000000002';
const placeId = '10000000-0000-4000-8000-000000000003';
const HOME = 'HOME' as SavedPlaceType;
const CUSTOM = 'CUSTOM' as SavedPlaceType;

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: placeId,
    userId,
    type: HOME,
    customLabel: null,
    longitude: 3.4,
    latitude: 6.4,
    formattedAddress: '1 Test Street',
    providerPlaceId: null,
    isActive: true,
    createdAt: new Date('2026-09-25T08:00:00.000Z'),
    updatedAt: new Date('2026-09-25T08:00:00.000Z'),
    ...overrides,
  };
}

function createService() {
  const repositoryMock = {
    findManyByUser: jest.fn().mockResolvedValue({ rows: [place()], total: 1 }),
    findOwnedById: jest.fn().mockResolvedValue(place()),
    create: jest.fn().mockResolvedValue(place()),
    updateOwned: jest.fn().mockResolvedValue(place()),
    deleteOwned: jest.fn().mockResolvedValue(true),
    findWithinIncidentRadius: jest.fn().mockResolvedValue([]),
  };
  return {
    service: new SavedPlacesService(repositoryMock as unknown as SavedPlacesRepository),
    repositoryMock,
  };
}

describe('SavedPlacesService', () => {
  it('lists only the authenticated user scope through the repository boundary', async () => {
    const harness = createService();

    const result = await harness.service.list(userId, 1, 20);

    expect(harness.repositoryMock.findManyByUser).toHaveBeenCalledWith({
      userId,
      page: 1,
      pageSize: 20,
    });
    expect(result.data[0]).not.toHaveProperty('userId');
  });

  it('rejects access when the repository cannot find an owned place', async () => {
    const harness = createService();
    harness.repositoryMock.findOwnedById.mockResolvedValue(null);

    await expect(harness.service.findById(placeId, otherUserId)).rejects.toThrow(
      'Saved place not found',
    );
    expect(harness.repositoryMock.findOwnedById).toHaveBeenCalledWith(placeId, otherUserId);
  });

  it('creates custom places only when a custom label is present', async () => {
    const harness = createService();

    await expect(
      harness.service.create({
        userId,
        type: CUSTOM,
        longitude: 3.4,
        latitude: 6.4,
        formattedAddress: '1 Test Street',
      }),
    ).rejects.toThrow('customLabel is required');

    await harness.service.create({
      userId,
      type: CUSTOM,
      customLabel: 'Flood refuge',
      longitude: 3.4,
      latitude: 6.4,
      formattedAddress: '1 Test Street',
    });
    expect(harness.repositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ customLabel: 'Flood refuge' }),
      expect.any(String),
    );
  });

  it('maps the standard-type unique constraint to a conflict error', async () => {
    const harness = createService();
    harness.repositoryMock.create.mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      harness.service.create({
        userId,
        type: HOME,
        longitude: 3.4,
        latitude: 6.4,
        formattedAddress: '1 Test Street',
      }),
    ).rejects.toThrow('standard saved place');
  });

  it('updates and deletes only through the owned repository methods', async () => {
    const harness = createService();

    await harness.service.update(placeId, userId, { formattedAddress: '2 Test Street' });
    await harness.service.delete(placeId, userId);

    expect(harness.repositoryMock.updateOwned).toHaveBeenCalledWith(
      placeId,
      userId,
      expect.objectContaining({ formattedAddress: '2 Test Street' }),
    );
    expect(harness.repositoryMock.deleteOwned).toHaveBeenCalledWith(placeId, userId);
  });

  it('delegates incident matching with a bounded radius', async () => {
    const harness = createService();
    const incidentId = '10000000-0000-4000-8000-000000000004';

    await harness.service.findPlacesAffectedByIncident(incidentId, 500);

    expect(harness.repositoryMock.findWithinIncidentRadius).toHaveBeenCalledWith(incidentId, 500);
    await expect(harness.service.findPlacesAffectedByIncident(incidentId, 0)).rejects.toThrow(
      'radiusMeters must be between 1 and 100000',
    );
  });
});

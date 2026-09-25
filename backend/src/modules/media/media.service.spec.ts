import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MediaStatus } from '@prisma/client';
import { MediaService } from './media.service';

const userId = '10000000-0000-4000-8000-000000000001';
const reportId = '10000000-0000-4000-8000-000000000010';
const mediaId = '10000000-0000-4000-8000-000000000011';

const pendingMedia = {
  id: mediaId,
  uploaderUserId: userId,
  reportId,
  storageKey: `media/reports/${reportId}/${mediaId}`,
  contentType: 'image/jpeg',
  byteSize: 2_048,
  width: null,
  height: null,
  status: MediaStatus.PENDING,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService() {
  const repository = {
    findReportOwner: jest.fn().mockResolvedValue(userId),
    createPending: jest.fn().mockResolvedValue(pendingMedia),
    markFailed: jest.fn().mockResolvedValue(undefined),
    findOwnedById: jest.fn().mockResolvedValue(pendingMedia),
    findAvailableByIncident: jest.fn().mockResolvedValue([]),
    markAvailableAndRefreshIncidentPhotoCount: jest.fn(),
  };
  const storageProvider = {
    authorizeUpload: jest.fn().mockResolvedValue({
      method: 'PUT',
      url: 'local://upload/signed',
      headers: { 'content-type': 'image/jpeg' },
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    }),
    inspectObject: jest.fn(),
    createReadUrl: jest.fn().mockResolvedValue({
      url: 'local://read/signed',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    }),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'media.maxBytes': 10_000,
        'media.uploadUrlTtlSeconds': 900,
        'media.accessUrlTtlSeconds': 900,
      };
      return values[key];
    }),
  };

  return {
    service: new MediaService(configService as never, repository as never, storageProvider),
    repository,
    storageProvider,
  };
}

describe('MediaService', () => {
  it('authorizes an owned image upload with a server-generated storage key', async () => {
    const harness = createService();

    const response = await harness.service.authorizeUpload(userId, {
      reportId,
      contentType: 'IMAGE/JPEG',
      byteSize: 2_048,
    });

    expect(response.upload.url).toBe('local://upload/signed');
    expect(response.media).not.toHaveProperty('storageKey');
    expect(harness.storageProvider.authorizeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'image/jpeg',
        maxBytes: 10_000,
      }),
    );
    const authorization = (
      harness.storageProvider.authorizeUpload.mock.calls as unknown[][]
    )[0]?.[0] as {
      storageKey: string;
    };
    expect(authorization.storageKey).toMatch(
      new RegExp(`^media/reports/${reportId}/[0-9a-f-]{36}$`),
    );
  });

  it('rejects upload authorization for a report owned by another user', async () => {
    const harness = createService();
    harness.repository.findReportOwner.mockResolvedValue('10000000-0000-4000-8000-000000000099');

    await expect(
      harness.service.authorizeUpload(userId, {
        reportId,
        contentType: 'image/jpeg',
        byteSize: 2_048,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.repository.createPending).not.toHaveBeenCalled();
  });

  it('rejects unsupported image types and configured size-limit violations', async () => {
    const harness = createService();

    await expect(
      harness.service.authorizeUpload(userId, {
        reportId,
        contentType: 'image/gif',
        byteSize: 2_048,
      }),
    ).rejects.toThrow('Only JPEG, PNG, and WebP');
    await expect(
      harness.service.authorizeUpload(userId, {
        reportId,
        contentType: 'image/jpeg',
        byteSize: 10_001,
      }),
    ).rejects.toThrow('byteSize must be between');
    expect(harness.repository.findReportOwner).not.toHaveBeenCalled();
  });

  it('rejects authorization when the report does not exist', async () => {
    const harness = createService();
    harness.repository.findReportOwner.mockResolvedValue(null);

    await expect(
      harness.service.authorizeUpload(userId, {
        reportId,
        contentType: 'image/jpeg',
        byteSize: 2_048,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifies provider metadata before making media available and returns an expiring URL', async () => {
    const harness = createService();
    const availableMedia = {
      ...pendingMedia,
      status: MediaStatus.AVAILABLE,
      width: 1_920,
      height: 1_080,
    };
    harness.storageProvider.inspectObject.mockResolvedValue({
      contentType: 'image/jpeg',
      byteSize: 2_048,
      width: 1_920,
      height: 1_080,
    });
    harness.repository.markAvailableAndRefreshIncidentPhotoCount.mockResolvedValue(availableMedia);

    const response = await harness.service.completeUpload(userId, mediaId);

    expect(response).toMatchObject({
      id: mediaId,
      status: MediaStatus.AVAILABLE,
      width: 1_920,
      height: 1_080,
      accessUrl: 'local://read/signed',
    });
    expect(response).not.toHaveProperty('storageKey');
    expect(harness.repository.markAvailableAndRefreshIncidentPhotoCount).toHaveBeenCalledWith(
      mediaId,
      userId,
      { byteSize: 2_048, width: 1_920, height: 1_080 },
    );
  });

  it('rejects a missing or mismatched uploaded object', async () => {
    const harness = createService();
    harness.storageProvider.inspectObject.mockResolvedValue(null);
    await expect(harness.service.completeUpload(userId, mediaId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    harness.storageProvider.inspectObject.mockResolvedValue({
      contentType: 'image/png',
      byteSize: 2_048,
    });
    await expect(harness.service.completeUpload(userId, mediaId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(harness.repository.markFailed).toHaveBeenCalledWith(mediaId, userId);
  });

  it('returns safe available-photo summaries with expiring read URLs', async () => {
    const harness = createService();
    harness.repository.findAvailableByIncident.mockResolvedValue([
      {
        ...pendingMedia,
        status: MediaStatus.AVAILABLE,
        width: 800,
        height: 600,
      },
    ]);

    await expect(harness.service.getAvailableIncidentPhotos(reportId)).resolves.toEqual([
      expect.objectContaining({
        id: mediaId,
        accessUrl: 'local://read/signed',
      }),
    ]);
  });
});

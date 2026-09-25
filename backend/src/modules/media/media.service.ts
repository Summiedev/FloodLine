import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { MAX_REQUESTED_MEDIA_BYTES, SUPPORTED_IMAGE_CONTENT_TYPES } from './media.constants';
import { MediaRepository, MediaRecord } from './media.repository';
import type {
  MediaPhotoSummary,
  MediaResponseDto,
  MediaUploadAuthorizationResponse,
} from './media.types';
import { STORAGE_PROVIDER, StorageProvider, StoredObjectMetadata } from './storage-provider';

@Injectable()
export class MediaService {
  private readonly maxBytes: number;
  private readonly uploadUrlTtlSeconds: number;
  private readonly accessUrlTtlSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly mediaRepository: MediaRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {
    this.maxBytes = configService.getOrThrow<number>('media.maxBytes');
    this.uploadUrlTtlSeconds = configService.getOrThrow<number>('media.uploadUrlTtlSeconds');
    this.accessUrlTtlSeconds = configService.getOrThrow<number>('media.accessUrlTtlSeconds');
  }

  async authorizeUpload(
    uploaderUserId: string,
    command: { reportId: string; contentType: string; byteSize: number },
  ): Promise<MediaUploadAuthorizationResponse> {
    this.assertUuid(uploaderUserId, 'uploaderUserId');
    this.assertUuid(command.reportId, 'reportId');
    const contentType = this.normalizeContentType(command.contentType);
    this.validateByteSize(command.byteSize);

    const reportOwnerId = await this.mediaRepository.findReportOwner(command.reportId);
    if (!reportOwnerId) {
      throw new NotFoundException('Flood report not found');
    }
    if (reportOwnerId !== uploaderUserId) {
      throw new ForbiddenException('You do not own this flood report');
    }

    const mediaId = randomUUID();
    const storageKey = `media/reports/${command.reportId}/${mediaId}`;
    const media = await this.mediaRepository.createPending({
      id: mediaId,
      uploaderUserId,
      reportId: command.reportId,
      storageKey,
      contentType,
      byteSize: command.byteSize,
    });

    try {
      const upload = await this.storageProvider.authorizeUpload({
        storageKey,
        contentType,
        maxBytes: this.maxBytes,
        expiresInSeconds: this.uploadUrlTtlSeconds,
      });

      return {
        media: this.toResponse(media),
        upload,
      };
    } catch {
      await this.mediaRepository.markFailed(mediaId, uploaderUserId);
      throw this.storageDependencyError();
    }
  }

  async completeUpload(uploaderUserId: string, mediaId: string): Promise<MediaResponseDto> {
    this.assertUuid(uploaderUserId, 'uploaderUserId');
    this.assertUuid(mediaId, 'mediaId');
    const media = await this.mediaRepository.findOwnedById(mediaId, uploaderUserId);

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.status === MediaStatus.AVAILABLE) {
      return this.withReadUrl(media);
    }
    if (media.status !== MediaStatus.PENDING) {
      throw new ConflictException('Media is not awaiting completion');
    }

    let object: StoredObjectMetadata | null;
    try {
      object = await this.storageProvider.inspectObject(media.storageKey);
    } catch {
      throw this.storageDependencyError();
    }

    if (!object) {
      throw new ConflictException('Uploaded media object was not found');
    }

    const metadata = await this.validateStoredObject(media, object);
    const completed = await this.mediaRepository.markAvailableAndRefreshIncidentPhotoCount(
      media.id,
      uploaderUserId,
      metadata,
    );

    if (!completed) {
      const current = await this.mediaRepository.findOwnedById(media.id, uploaderUserId);
      if (current?.status === MediaStatus.AVAILABLE) {
        return this.withReadUrl(current);
      }
      throw new ConflictException('Media completion could not be committed');
    }

    return this.withReadUrl(completed);
  }

  async getAvailableIncidentPhotos(incidentId: string): Promise<MediaPhotoSummary[]> {
    this.assertUuid(incidentId, 'incidentId');
    const media = await this.mediaRepository.findAvailableByIncident(incidentId);

    return Promise.all(
      media.map(async (item) => {
        try {
          const readUrl = await this.storageProvider.createReadUrl(
            item.storageKey,
            this.accessUrlTtlSeconds,
          );
          return {
            id: item.id,
            contentType: item.contentType,
            byteSize: item.byteSize,
            width: item.width,
            height: item.height,
            createdAt: item.createdAt,
            accessUrl: readUrl.url,
            accessUrlExpiresAt: readUrl.expiresAt,
          };
        } catch {
          return {
            id: item.id,
            contentType: item.contentType,
            byteSize: item.byteSize,
            width: item.width,
            height: item.height,
            createdAt: item.createdAt,
          };
        }
      }),
    );
  }

  private async withReadUrl(media: MediaRecord): Promise<MediaResponseDto> {
    try {
      const readUrl = await this.storageProvider.createReadUrl(
        media.storageKey,
        this.accessUrlTtlSeconds,
      );
      return {
        ...this.toResponse(media),
        accessUrl: readUrl.url,
        accessUrlExpiresAt: readUrl.expiresAt,
      };
    } catch {
      throw this.storageDependencyError();
    }
  }

  private async validateStoredObject(
    media: MediaRecord,
    object: StoredObjectMetadata,
  ): Promise<{ byteSize: number; width: number | null; height: number | null }> {
    let actualContentType: string;
    try {
      actualContentType = this.normalizeContentType(object.contentType);
    } catch {
      await this.mediaRepository.markFailed(media.id, media.uploaderUserId);
      throw new ConflictException('Uploaded media type is not supported');
    }
    if (
      actualContentType !== media.contentType ||
      !Number.isInteger(object.byteSize) ||
      object.byteSize !== media.byteSize ||
      object.byteSize > this.maxBytes
    ) {
      await this.mediaRepository.markFailed(media.id, media.uploaderUserId);
      throw new ConflictException('Uploaded media metadata does not match the authorization');
    }

    const width = this.normalizeDimension(object.width);
    const height = this.normalizeDimension(object.height);
    return {
      byteSize: object.byteSize,
      width: width !== null && height !== null ? width : null,
      height: width !== null && height !== null ? height : null,
    };
  }

  private normalizeContentType(contentType: string): string {
    const normalized = contentType.trim().toLowerCase();
    if (!(SUPPORTED_IMAGE_CONTENT_TYPES as readonly string[]).includes(normalized)) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'Only JPEG, PNG, and WebP images are supported',
      );
    }
    return normalized;
  }

  private validateByteSize(byteSize: number): void {
    if (
      !Number.isInteger(byteSize) ||
      byteSize < 1 ||
      byteSize > MAX_REQUESTED_MEDIA_BYTES ||
      byteSize > this.maxBytes
    ) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `byteSize must be between 1 and ${this.maxBytes} bytes`,
      );
    }
  }

  private normalizeDimension(value: number | undefined): number | null {
    if (value === undefined || !Number.isInteger(value) || value <= 0 || value > 50_000) {
      return null;
    }
    return value;
  }

  private toResponse(media: MediaRecord): MediaResponseDto {
    return {
      id: media.id,
      reportId: media.reportId,
      contentType: media.contentType,
      byteSize: media.byteSize,
      width: media.width,
      height: media.height,
      status: media.status,
      createdAt: media.createdAt,
    };
  }

  private storageDependencyError(): ApplicationError {
    return new ApplicationError(
      ErrorCodes.DependencyUnavailable,
      'Media storage is temporarily unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}

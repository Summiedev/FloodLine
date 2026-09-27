import { HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentSeverity, OfficialWarningStatus } from '@prisma/client';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta } from '../../common/pagination/pagination.dto';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { assertSafeText } from '../../common/security/input-safety';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  OFFICIAL_WARNING_CANCELLED_JOB,
  OFFICIAL_WARNING_CHANGED_JOB,
  OFFICIAL_WARNING_CREATED_JOB,
  OFFICIAL_WARNING_EXPIRED_JOB,
} from './official-warnings.constants';
import { OfficialWarningsRepository } from './official-warnings.repository';
import type {
  OfficialWarningFilters,
  OfficialWarningFeedItem,
  OfficialWarningGeometry,
  OfficialWarningListResponse,
  OfficialWarningProvider,
  OfficialWarningRecord,
  OfficialWarningResponse,
  OfficialWarningUpsertInput,
  OfficialWarningUpsertResult,
} from './official-warning.types';

export interface OfficialWarningEventPayload {
  warningId: string;
  authority: string;
  externalId: string;
  occurredAt: string;
}

@Injectable()
export class OfficialWarningsService {
  private readonly providerTimeoutMs: number;
  private readonly maxFeedItems: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OfficialWarningsRepository,
    private readonly queueService: QueueService,
    private readonly logger: StructuredLogger,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() configService?: ConfigService,
  ) {
    this.providerTimeoutMs =
      configService?.get<number>('officialWarning.providerTimeoutMs') ?? 10_000;
    this.maxFeedItems = configService?.get<number>('officialWarning.maxFeedItems') ?? 1_000;
  }

  async list(filters: OfficialWarningFilters): Promise<OfficialWarningListResponse> {
    const result = await this.repository.findMany(filters);
    return {
      data: result.rows.map((warning) => this.toResponse(warning)),
      meta: createPaginationMeta(filters.page, filters.pageSize, result.total),
    };
  }

  async findById(id: string): Promise<OfficialWarningResponse> {
    this.assertUuid(id);
    const warning = await this.repository.findById(id);
    if (!warning) {
      throw new NotFoundException('Official warning not found');
    }
    return this.toResponse(warning);
  }

  async ingest(provider: OfficialWarningProvider): Promise<OfficialWarningResponse[]> {
    this.validateAuthority(provider.authority);
    const feedItems = await this.fetchProviderWarnings(provider);
    if (feedItems.length > this.maxFeedItems) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'Official warning feed contains too many items',
      );
    }
    const results: OfficialWarningResponse[] = [];
    for (const item of feedItems) {
      results.push((await this.upsert({ ...item, authority: provider.authority })).warning);
    }
    return results;
  }

  private async fetchProviderWarnings(
    provider: OfficialWarningProvider,
  ): Promise<OfficialWarningFeedItem[]> {
    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    try {
      const providerPromise = provider.fetchWarnings({ signal: controller.signal });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Official warning provider timed out'));
        }, this.providerTimeoutMs);
      });
      const result = await Promise.race([providerPromise, timeoutPromise]);
      if (!Array.isArray(result)) {
        throw new Error('Official warning provider returned an invalid feed');
      }
      return result;
    } catch {
      throw new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Official warning provider is temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async upsert(input: OfficialWarningUpsertInput): Promise<{
    warning: OfficialWarningResponse;
    created: boolean;
    materiallyChanged: boolean;
  }> {
    const normalized = this.normalizeAndValidate(input);
    const result = await this.prisma.$transaction(async (transaction) => {
      const existing = await this.repository.findByIdentity(
        transaction,
        normalized.authority,
        normalized.externalId,
        true,
      );
      const persisted = await this.repository.upsertWithinTransaction(transaction, normalized);
      const materiallyChanged = persisted.inserted
        ? true
        : existing
          ? this.materiallyChanged(existing, persisted.record)
          : false;

      return {
        warning: persisted.record,
        created: persisted.inserted,
        materiallyChanged,
        previousStatus: existing?.status ?? null,
        existing,
      } satisfies OfficialWarningUpsertResult & { existing: OfficialWarningRecord | null };
    });

    if (result.created || result.materiallyChanged) {
      this.metrics?.increment('official_warning_changes_total', {
        change: result.created ? 'created' : 'updated',
      });
      await this.emitChangeEvents(result);
    }

    return {
      warning: this.toResponse(result.warning),
      created: result.created,
      materiallyChanged: result.materiallyChanged,
    };
  }

  /** Idempotent sweep used by the background worker. */
  async expireDueWarnings(): Promise<number> {
    const expired = await this.repository.expireDue();
    for (const warning of expired) {
      await this.emitEvent(OFFICIAL_WARNING_EXPIRED_JOB, {
        warningId: warning.id,
        authority: warning.authority,
        externalId: warning.externalId,
        occurredAt: warning.updatedAt.toISOString(),
      });
    }
    return expired.length;
  }

  private async emitChangeEvents(
    result: OfficialWarningUpsertResult & { existing: OfficialWarningRecord | null },
  ): Promise<void> {
    if (result.created) {
      await this.emitEvent(OFFICIAL_WARNING_CREATED_JOB, this.eventPayload(result.warning));
      return;
    }

    if (result.warning.status === OfficialWarningStatus.CANCELLED) {
      await this.emitEvent(OFFICIAL_WARNING_CANCELLED_JOB, this.eventPayload(result.warning));
    } else if (
      result.warning.status === OfficialWarningStatus.EXPIRED &&
      result.existing?.status !== OfficialWarningStatus.EXPIRED
    ) {
      await this.emitEvent(OFFICIAL_WARNING_EXPIRED_JOB, this.eventPayload(result.warning));
    } else {
      await this.emitEvent(OFFICIAL_WARNING_CHANGED_JOB, this.eventPayload(result.warning));
    }
  }

  private async emitEvent(jobName: string, payload: OfficialWarningEventPayload): Promise<void> {
    try {
      await this.queueService.enqueueSystemJob(jobName, payload, {
        jobId: `${jobName}-${payload.warningId}-${payload.occurredAt}`,
        attempts: 3,
        backoffMs: 1_000,
      });
    } catch (error) {
      this.logger.error(
        error,
        error instanceof Error ? error.stack : undefined,
        `OfficialWarningsService.emitEvent.${jobName}`,
      );
    }
  }

  private eventPayload(warning: OfficialWarningRecord): OfficialWarningEventPayload {
    return {
      warningId: warning.id,
      authority: warning.authority,
      externalId: warning.externalId,
      occurredAt: warning.updatedAt.toISOString(),
    };
  }

  private normalizeAndValidate(input: OfficialWarningUpsertInput): OfficialWarningUpsertInput {
    this.validateAuthority(input.authority);
    this.validateText(input.externalId, 'externalId', 255);
    this.validateText(input.title, 'title', 300);
    this.validateText(input.description, 'description', 50_000);
    if (!Object.values(IncidentSeverity).includes(input.severity)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'severity is invalid');
    }
    this.validateGeometry(input.affectedGeometry);
    this.validateDate(input.issuedAt, 'issuedAt');
    this.validateDate(input.effectiveAt, 'effectiveAt');
    if (input.effectiveAt < input.issuedAt) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'effectiveAt cannot precede issuedAt');
    }
    if (input.expiresAt && input.expiresAt < input.effectiveAt) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'expiresAt cannot precede effectiveAt',
      );
    }
    if (input.sourceUrl) {
      this.validateSourceUrl(input.sourceUrl);
    }
    if (input.rawProviderMetadata) {
      let serialized: string;
      try {
        serialized = JSON.stringify(input.rawProviderMetadata);
      } catch {
        throw new ApplicationError(ErrorCodes.ValidationError, 'rawProviderMetadata must be JSON');
      }
      if (serialized.length > 100_000) {
        throw new ApplicationError(
          ErrorCodes.ValidationError,
          'rawProviderMetadata must be at most 100000 characters',
        );
      }
    }

    const status =
      input.status ??
      (input.expiresAt && input.expiresAt <= new Date()
        ? OfficialWarningStatus.EXPIRED
        : OfficialWarningStatus.ACTIVE);
    return {
      ...input,
      authority: input.authority.trim(),
      externalId: input.externalId.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      sourceUrl: input.sourceUrl?.trim() ?? null,
      status,
    };
  }

  private materiallyChanged(a: OfficialWarningRecord, b: OfficialWarningRecord): boolean {
    return (
      a.title !== b.title ||
      a.description !== b.description ||
      a.severity !== b.severity ||
      a.status !== b.status ||
      a.issuedAt.getTime() !== b.issuedAt.getTime() ||
      a.effectiveAt.getTime() !== b.effectiveAt.getTime() ||
      a.expiresAt?.getTime() !== b.expiresAt?.getTime() ||
      a.sourceUrl !== b.sourceUrl ||
      JSON.stringify(a.affectedGeometry) !== JSON.stringify(b.affectedGeometry)
    );
  }

  private toResponse(warning: OfficialWarningRecord): OfficialWarningResponse {
    const effectiveStatus =
      warning.status === OfficialWarningStatus.ACTIVE &&
      warning.expiresAt !== null &&
      warning.expiresAt <= new Date()
        ? OfficialWarningStatus.EXPIRED
        : warning.status;
    return {
      ...warning,
      status: effectiveStatus,
      isActive:
        effectiveStatus === OfficialWarningStatus.ACTIVE && warning.effectiveAt <= new Date(),
    };
  }

  private validateGeometry(geometry: OfficialWarningGeometry): void {
    if (
      !geometry ||
      !Object.values([
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ]).includes(geometry.type)
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'affectedGeometry type is invalid');
    }
    const serialized = JSON.stringify(geometry);
    if (serialized.length > 2_000_000) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'affectedGeometry is too large');
    }
    let coordinateCount = 0;
    const visit = (value: unknown, depth: number): void => {
      if (depth > 20) {
        throw new ApplicationError(
          ErrorCodes.ValidationError,
          'affectedGeometry nesting is too deep',
        );
      }
      if (!Array.isArray(value)) {
        throw new ApplicationError(
          ErrorCodes.ValidationError,
          'affectedGeometry coordinates are invalid',
        );
      }
      if (value.length >= 2 && value.every((item) => typeof item === 'number')) {
        const [longitude, latitude] = value;
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          longitude < -180 ||
          longitude > 180 ||
          latitude < -90 ||
          latitude > 90
        ) {
          throw new ApplicationError(
            ErrorCodes.ValidationError,
            'affectedGeometry coordinates are invalid',
          );
        }
        coordinateCount += 1;
        if (coordinateCount > 50_000) {
          throw new ApplicationError(
            ErrorCodes.ValidationError,
            'affectedGeometry contains too many coordinates',
          );
        }
        return;
      }
      for (const child of value) visit(child, depth + 1);
    };
    visit(geometry.coordinates, 0);
    if (coordinateCount === 0) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'affectedGeometry must contain coordinates',
      );
    }
  }

  private validateAuthority(authority: string): void {
    this.validateText(authority, 'authority', 120);
  }

  private validateText(value: string, field: string, maxLength: number): void {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `${field} must contain between 1 and ${maxLength} characters`,
      );
    }
    assertSafeText(value, field);
  }

  private validateDate(value: Date, field: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid date`);
    }
  }

  private validateSourceUrl(value: string): void {
    if (value.length > 2_048) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'sourceUrl is too long');
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new ApplicationError(ErrorCodes.ValidationError, 'sourceUrl must be an HTTP(S) URL');
    }
  }

  private assertUuid(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'id must be a valid UUID');
    }
  }

  toFilters(query: {
    active?: boolean;
    status?: OfficialWarningFilters['status'];
    longitude?: number;
    latitude?: number;
    radiusMeters?: number;
    issuedFrom?: string;
    issuedTo?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    updatedSince?: string;
    page: number;
    pageSize: number;
  }): OfficialWarningFilters {
    const locationValues = [query.longitude, query.latitude, query.radiusMeters];
    const hasAnyLocation = locationValues.some((value) => value !== undefined);
    const hasCompleteLocation = locationValues.every((value) => value !== undefined);
    if (hasAnyLocation && !hasCompleteLocation) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'longitude, latitude, and radiusMeters must be provided together',
      );
    }
    const date = (value: string | undefined): Date | undefined =>
      value ? new Date(value) : undefined;
    return {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(hasCompleteLocation
        ? {
            longitude: query.longitude,
            latitude: query.latitude,
            radiusMeters: query.radiusMeters,
          }
        : {}),
      ...(query.issuedFrom ? { issuedFrom: date(query.issuedFrom) } : {}),
      ...(query.issuedTo ? { issuedTo: date(query.issuedTo) } : {}),
      ...(query.effectiveFrom ? { effectiveFrom: date(query.effectiveFrom) } : {}),
      ...(query.effectiveTo ? { effectiveTo: date(query.effectiveTo) } : {}),
      ...(query.updatedSince ? { updatedSince: date(query.updatedSince) } : {}),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

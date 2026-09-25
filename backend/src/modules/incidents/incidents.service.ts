import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { IncidentStatus, Prisma } from '@prisma/client';
import { createPaginationMeta, PaginatedResponse } from '../../common/pagination/pagination.dto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { MediaService } from '../media/media.service';
import { IncidentConfidencePolicy } from './incident-confidence.policy';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { IncidentResponseDto } from './incident-response.dto';
import { IncidentsRepository } from './incidents.repository';
import type {
  Coordinate,
  CreateIncidentCommand,
  IncidentFilters,
  RawIncidentRow,
  UpdateIncidentCommand,
} from './incident.types';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly confidencePolicy: IncidentConfidencePolicy,
    @Optional() private readonly mediaService?: MediaService,
  ) {}

  async list(query: IncidentQueryDto): Promise<PaginatedResponse<IncidentResponseDto>> {
    const filters = this.toFilters(query);
    const result = await this.incidentsRepository.findMany(filters);

    return {
      data: result.rows.map((row) => this.toResponse(row)),
      meta: createPaginationMeta(query.page, query.pageSize, result.total),
    };
  }

  async findById(id: string): Promise<IncidentResponseDto> {
    this.assertUuid(id);
    const incident = await this.incidentsRepository.findById(id);

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const response = this.toResponse(incident);
    if (this.mediaService) {
      response.reportPhotos.items = await this.mediaService.getAvailableIncidentPhotos(id);
      response.reportPhotos.count = response.reportPhotos.items.length;
    }
    return response;
  }

  /**
   * Internal domain entry point for future report and authority integrations.
   * Confidence is derived from source type and cannot be supplied by callers.
   */
  async createIncident(command: CreateIncidentCommand): Promise<IncidentResponseDto> {
    this.validateCreateCommand(command);
    const firstReportedAt = command.firstReportedAt ?? new Date();
    const confidence = this.confidencePolicy.calculate(command.sourceType);
    const incident = await this.incidentsRepository.create({
      ...this.toIncidentCreateRecord(command, confidence, firstReportedAt),
    });

    return this.toResponse(incident);
  }

  /**
   * Transaction-aware entry point for domain modules that must create an
   * incident together with their own aggregate in one database transaction.
   */
  async createIncidentInTransaction(
    transaction: Prisma.TransactionClient,
    command: CreateIncidentCommand,
  ): Promise<IncidentResponseDto> {
    this.validateCreateCommand(command);
    const firstReportedAt = command.firstReportedAt ?? new Date();
    const confidence = this.confidencePolicy.calculate(command.sourceType);
    const incident = await this.incidentsRepository.createWithinTransaction(
      transaction,
      this.toIncidentCreateRecord(command, confidence, firstReportedAt),
    );

    return this.toResponse(incident);
  }

  async findByIdInTransaction(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<IncidentResponseDto | null> {
    this.assertUuid(id);
    const incident = await this.incidentsRepository.findByIdWithinTransaction(transaction, id);
    return incident ? this.toResponse(incident) : null;
  }

  private toIncidentCreateRecord(
    command: CreateIncidentCommand,
    confidence: ReturnType<IncidentConfidencePolicy['calculate']>,
    firstReportedAt: Date,
  ) {
    return {
      id: randomUUID(),
      incidentType: command.incidentType,
      severity: command.severity,
      status: IncidentStatus.ACTIVE,
      longitude: command.location.longitude,
      latitude: command.location.latitude,
      locationName: command.locationName.trim(),
      description: command.description.trim(),
      confidence,
      sourceType: command.sourceType,
      firstReportedAt,
      expiresAt: command.expiresAt ?? null,
    };
  }

  /**
   * Internal domain entry point for lifecycle changes. Confidence fields are
   * intentionally absent; only the confidence policy may derive them.
   */
  async updateIncident(id: string, command: UpdateIncidentCommand): Promise<IncidentResponseDto> {
    this.assertUuid(id);
    const current = await this.incidentsRepository.findById(id);

    if (!current) {
      throw new NotFoundException('Incident not found');
    }

    const nextStatus = command.status ?? current.status;
    if (
      (current.status === IncidentStatus.RESOLVED ||
        current.status === IncidentStatus.REJECTED ||
        current.status === IncidentStatus.EXPIRED) &&
      nextStatus === IncidentStatus.ACTIVE
    ) {
      throw new ConflictException('A terminal incident cannot be reactivated');
    }

    if (command.location) {
      this.validateCoordinate(command.location);
    }

    const resolvedAt =
      nextStatus === IncidentStatus.RESOLVED
        ? (command.resolvedAt ?? current.resolvedAt ?? new Date())
        : command.resolvedAt;

    if (
      nextStatus === IncidentStatus.ACTIVE &&
      command.expiresAt !== undefined &&
      command.expiresAt !== null &&
      command.expiresAt <= new Date()
    ) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'An active incident must expire in the future',
      );
    }

    const updated = await this.incidentsRepository.update(id, {
      ...command,
      locationName: command.locationName?.trim(),
      description: command.description?.trim(),
      status: nextStatus,
      resolvedAt,
      ...(command.location
        ? {
            longitude: command.location.longitude,
            latitude: command.location.latitude,
          }
        : {}),
    });

    if (!updated) {
      throw new NotFoundException('Incident not found');
    }

    return this.toResponse(updated);
  }

  private toFilters(query: IncidentQueryDto): IncidentFilters {
    const bboxValues = [query.west, query.south, query.east, query.north];
    const hasAnyBboxValue = bboxValues.some((value) => value !== undefined);
    const hasCompleteBbox = bboxValues.every((value) => value !== undefined);
    const centerValues = [query.longitude, query.latitude, query.radiusMeters];
    const hasAnyCenterValue = centerValues.some((value) => value !== undefined);
    const hasCompleteCenter = centerValues.every((value) => value !== undefined);

    if (hasAnyBboxValue && !hasCompleteBbox) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'west, south, east, and north must be provided together',
      );
    }
    if (hasAnyCenterValue && !hasCompleteCenter) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'longitude, latitude, and radiusMeters must be provided together',
      );
    }
    if (hasCompleteBbox && query.west! >= query.east!) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'west must be less than east');
    }
    if (hasCompleteBbox && query.south! >= query.north!) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'south must be less than north');
    }
    if (hasCompleteBbox && hasCompleteCenter) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'Use either a bounding box or a center-radius query, not both',
      );
    }

    return {
      ...(hasCompleteBbox
        ? {
            bbox: {
              west: query.west!,
              south: query.south!,
              east: query.east!,
              north: query.north!,
            },
          }
        : {}),
      ...(hasCompleteCenter
        ? {
            center: {
              longitude: query.longitude!,
              latitude: query.latitude!,
              radiusMeters: query.radiusMeters!,
            },
          }
        : {}),
      ...(query.incidentType ? { incidentType: query.incidentType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.updatedSince ? { updatedSince: new Date(query.updatedSince) } : {}),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private validateCreateCommand(command: CreateIncidentCommand): void {
    this.validateCoordinate(command.location);
    this.validateText(command.locationName, 'locationName', 200);
    this.validateText(command.description, 'description', 20_000);

    const firstReportedAt = command.firstReportedAt ?? new Date();
    if (firstReportedAt > new Date()) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'firstReportedAt cannot be in the future',
      );
    }
    if (command.expiresAt !== undefined && command.expiresAt !== null) {
      if (command.expiresAt <= new Date()) {
        throw new ApplicationError(ErrorCodes.ValidationError, 'expiresAt must be in the future');
      }
    }
  }

  private validateCoordinate(coordinate: Coordinate): void {
    if (
      !Number.isFinite(coordinate.longitude) ||
      coordinate.longitude < -180 ||
      coordinate.longitude > 180
    ) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'longitude must be between -180 and 180',
      );
    }
    if (
      !Number.isFinite(coordinate.latitude) ||
      coordinate.latitude < -90 ||
      coordinate.latitude > 90
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'latitude must be between -90 and 90');
    }
  }

  private validateText(value: string, field: string, maxLength: number): void {
    if (!value.trim() || value.trim().length > maxLength) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `${field} must contain between 1 and ${maxLength} characters`,
      );
    }
  }

  private assertUuid(id: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'id must be a valid UUID');
    }
  }

  private toResponse(row: RawIncidentRow): IncidentResponseDto {
    let affectedGeometry: Record<string, unknown> | null = null;
    if (row.affectedGeometry) {
      try {
        const parsed: unknown = JSON.parse(row.affectedGeometry);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          affectedGeometry = parsed as Record<string, unknown>;
        }
      } catch {
        affectedGeometry = null;
      }
    }

    return {
      id: row.id,
      incidentType: row.incidentType,
      severity: row.severity,
      status: row.status,
      location: {
        longitude: row.longitude,
        latitude: row.latitude,
        srid: 4326,
      },
      affectedGeometry,
      locationName: row.locationName,
      description: row.description,
      confidence: {
        score: row.confidenceScore,
        label: row.confidenceLabel,
      },
      sourceType: row.sourceType,
      confirmationCount: row.confirmationCount,
      photoCount: row.photoCount,
      reportPhotos: row.reportPhotos ?? { count: 0, items: [] },
      firstReportedAt: row.firstReportedAt,
      lastConfirmedAt: row.lastConfirmedAt,
      resolvedAt: row.resolvedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(row.distanceMeters !== null ? { distanceMeters: row.distanceMeters } : {}),
    };
  }
}

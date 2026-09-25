import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SavedPlaceType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta } from '../../common/pagination/pagination.dto';
import { SavedPlacesRepository } from './saved-places.repository';
import type {
  SavedPlaceCreateInput,
  SavedPlaceListResponse,
  SavedPlaceMatch,
  SavedPlaceResponse,
  SavedPlaceUpdateInput,
} from './saved-place.types';

@Injectable()
export class SavedPlacesService {
  constructor(private readonly repository: SavedPlacesRepository) {}

  async list(userId: string, page: number, pageSize: number): Promise<SavedPlaceListResponse> {
    this.assertUuid(userId, 'userId');
    const result = await this.repository.findManyByUser({ userId, page, pageSize });
    return {
      data: result.rows.map((place) => this.toResponse(place)),
      meta: createPaginationMeta(page, pageSize, result.total),
    };
  }

  async findById(id: string, userId: string): Promise<SavedPlaceResponse> {
    this.assertUuid(id, 'id');
    this.assertUuid(userId, 'userId');
    const place = await this.repository.findOwnedById(id, userId);
    if (!place) throw new NotFoundException('Saved place not found');
    return this.toResponse(place);
  }

  async create(input: SavedPlaceCreateInput): Promise<SavedPlaceResponse> {
    this.validateCreate(input);
    try {
      const place = await this.repository.create(
        {
          ...input,
          customLabel: this.normalizeLabel(input.customLabel),
          formattedAddress: input.formattedAddress.trim(),
          providerPlaceId: this.normalizeOptionalText(input.providerPlaceId),
        },
        randomUUID(),
      );
      return this.toResponse(place);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    id: string,
    userId: string,
    input: SavedPlaceUpdateInput,
  ): Promise<SavedPlaceResponse> {
    this.assertUuid(id, 'id');
    this.assertUuid(userId, 'userId');
    const current = await this.repository.findOwnedById(id, userId);
    if (!current) throw new NotFoundException('Saved place not found');

    const nextType = input.type ?? current.type;
    const nextLabel = input.customLabel !== undefined ? input.customLabel : current.customLabel;
    this.validateTypeAndLabel(nextType, nextLabel);
    if (input.longitude !== undefined || input.latitude !== undefined) {
      this.validateCoordinate(
        input.longitude ?? current.longitude,
        input.latitude ?? current.latitude,
      );
    }
    if (input.formattedAddress !== undefined) {
      this.validateText(input.formattedAddress, 'formattedAddress', 500);
    }
    if (input.providerPlaceId !== undefined && input.providerPlaceId !== null) {
      this.validateText(input.providerPlaceId, 'providerPlaceId', 255);
    }

    try {
      const updated = await this.repository.updateOwned(id, userId, {
        ...input,
        customLabel: this.normalizeLabel(nextLabel),
        ...(input.longitude !== undefined || input.latitude !== undefined
          ? {
              longitude: input.longitude ?? current.longitude,
              latitude: input.latitude ?? current.latitude,
            }
          : {}),
        ...(input.formattedAddress !== undefined
          ? { formattedAddress: input.formattedAddress.trim() }
          : {}),
        ...(input.providerPlaceId !== undefined
          ? { providerPlaceId: this.normalizeOptionalText(input.providerPlaceId) }
          : {}),
      });
      if (!updated) throw new NotFoundException('Saved place not found');
      return this.toResponse(updated);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    this.assertUuid(id, 'id');
    this.assertUuid(userId, 'userId');
    const deleted = await this.repository.deleteOwned(id, userId);
    if (!deleted) throw new NotFoundException('Saved place not found');
  }

  /** Alert-engine query: uses PostGIS against both incident point and affected area. */
  async findPlacesAffectedByIncident(
    incidentId: string,
    radiusMeters: number,
  ): Promise<SavedPlaceMatch[]> {
    this.assertUuid(incidentId, 'incidentId');
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 100_000) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'radiusMeters must be between 1 and 100000',
      );
    }
    return this.repository.findWithinIncidentRadius(incidentId, radiusMeters);
  }

  toResponse(place: {
    id: string;
    type: SavedPlaceType;
    customLabel: string | null;
    longitude: number;
    latitude: number;
    formattedAddress: string;
    providerPlaceId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SavedPlaceResponse {
    return {
      id: place.id,
      type: place.type,
      customLabel: place.customLabel,
      location: { longitude: place.longitude, latitude: place.latitude, srid: 4326 },
      formattedAddress: place.formattedAddress,
      providerPlaceId: place.providerPlaceId,
      isActive: place.isActive,
      createdAt: place.createdAt,
      updatedAt: place.updatedAt,
    };
  }

  private validateCreate(input: SavedPlaceCreateInput): void {
    this.assertUuid(input.userId, 'userId');
    if (!Object.values(SavedPlaceType).includes(input.type)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'type is invalid');
    }
    this.validateTypeAndLabel(input.type, input.customLabel);
    this.validateCoordinate(input.longitude, input.latitude);
    this.validateText(input.formattedAddress, 'formattedAddress', 500);
    if (input.providerPlaceId !== undefined && input.providerPlaceId !== null) {
      this.validateText(input.providerPlaceId, 'providerPlaceId', 255);
    }
  }

  private validateTypeAndLabel(type: SavedPlaceType, label: string | null | undefined): void {
    if (!Object.values(SavedPlaceType).includes(type)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'type is invalid');
    }
    if (type === SavedPlaceType.CUSTOM && !label?.trim()) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'customLabel is required for custom places',
      );
    }
    if (label !== undefined && label !== null) this.validateText(label, 'customLabel', 120);
  }

  private validateCoordinate(longitude: number, latitude: number): void {
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'longitude must be between -180 and 180',
      );
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'latitude must be between -90 and 90');
    }
  }

  private validateText(value: string, field: string, maxLength: number): void {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `${field} must contain between 1 and ${maxLength} characters`,
      );
    }
  }

  private normalizeLabel(value: string | null | undefined): string | null {
    return value === undefined || value === null ? null : value.trim();
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    return value === undefined || value === null ? null : value.trim();
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A standard saved place of this type already exists');
    }
    throw error;
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}

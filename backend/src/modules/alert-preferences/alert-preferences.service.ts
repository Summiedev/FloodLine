import { HttpStatus, Injectable } from '@nestjs/common';
import { IncidentType } from '@prisma/client';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AlertPreferencesRepository } from './alert-preferences.repository';
import { ALERTABLE_INCIDENT_TYPES, REQUIRED_ALERT_INCIDENT_TYPE } from './alert-preference.types';
import type {
  AlertPreferenceRecord,
  AlertPreferenceResponse,
  AlertPreferenceUpdateInput,
} from './alert-preference.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AlertPreferencesService {
  private readonly minimumRadiusMeters: number;
  private readonly maximumRadiusMeters: number;
  private readonly defaultRadiusMeters: number;

  constructor(
    configService: ConfigService,
    private readonly repository: AlertPreferencesRepository,
  ) {
    this.minimumRadiusMeters = configService.getOrThrow<number>(
      'alertPreference.minimumRadiusMeters',
    );
    this.maximumRadiusMeters = configService.getOrThrow<number>(
      'alertPreference.maximumRadiusMeters',
    );
    this.defaultRadiusMeters = configService.getOrThrow<number>(
      'alertPreference.defaultRadiusMeters',
    );
    if (
      this.minimumRadiusMeters > this.maximumRadiusMeters ||
      this.defaultRadiusMeters < this.minimumRadiusMeters ||
      this.defaultRadiusMeters > this.maximumRadiusMeters
    ) {
      throw new Error('Alert preference radius configuration is invalid');
    }
  }

  async getDefault(userId: string): Promise<AlertPreferenceResponse> {
    this.assertUuid(userId, 'userId');
    const preference = await this.repository.ensureDefault(userId, this.defaultRadiusMeters, [
      ...ALERTABLE_INCIDENT_TYPES,
    ]);
    return this.toResponse(preference);
  }

  async updateDefault(
    userId: string,
    input: AlertPreferenceUpdateInput,
  ): Promise<AlertPreferenceResponse> {
    this.assertUuid(userId, 'userId');
    const current = await this.repository.findDefault(userId);
    const radiusMeters = input.radiusMeters ?? current?.radiusMeters ?? this.defaultRadiusMeters;
    const incidentTypes = this.normalizeIncidentTypes(
      input.incidentTypes ?? current?.incidentTypes ?? [...ALERTABLE_INCIDENT_TYPES],
    );
    this.validateRadius(radiusMeters);

    const updated = await this.repository.upsertDefault(userId, radiusMeters, incidentTypes);
    return this.toResponse(updated);
  }

  /**
   * Alert-engine lookup. A future place-specific preference takes precedence;
   * otherwise the user's default profile is used.
   */
  async getForAlertEvaluation(
    userId: string,
    savedPlaceId?: string,
  ): Promise<AlertPreferenceRecord> {
    this.assertUuid(userId, 'userId');
    if (savedPlaceId !== undefined) this.assertUuid(savedPlaceId, 'savedPlaceId');
    const preference = await this.repository.findEffective(userId, savedPlaceId ?? null);
    return (
      preference ??
      (await this.repository.ensureDefault(userId, this.defaultRadiusMeters, [
        ...ALERTABLE_INCIDENT_TYPES,
      ]))
    );
  }

  private normalizeIncidentTypes(incidentTypes: IncidentType[]): IncidentType[] {
    const unique = [...new Set(incidentTypes)];
    const unsupported = unique.filter((type) => !ALERTABLE_INCIDENT_TYPES.includes(type));
    if (unsupported.length > 0) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'incidentTypes contains an unsupported incident type',
        HttpStatus.BAD_REQUEST,
        { unsupported },
      );
    }
    return ALERTABLE_INCIDENT_TYPES.filter(
      (type) => type === REQUIRED_ALERT_INCIDENT_TYPE || unique.includes(type),
    );
  }

  private validateRadius(radiusMeters: number): void {
    if (
      !Number.isInteger(radiusMeters) ||
      radiusMeters < this.minimumRadiusMeters ||
      radiusMeters > this.maximumRadiusMeters
    ) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `radiusMeters must be between ${this.minimumRadiusMeters} and ${this.maximumRadiusMeters}`,
      );
    }
  }

  private toResponse(preference: AlertPreferenceRecord): AlertPreferenceResponse {
    return {
      savedPlaceId: preference.savedPlaceId,
      radiusMeters: preference.radiusMeters,
      incidentTypes: [...preference.incidentTypes],
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}

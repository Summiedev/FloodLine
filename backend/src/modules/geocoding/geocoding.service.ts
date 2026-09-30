import { HttpStatus, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  GEOCODING_PROVIDER,
  type GeocodingCoordinates,
  type GeocodingPlace,
  type GeocodingProvider,
} from './geocoding.types';

class GeocodingTimeoutError extends Error {
  constructor() {
    super('Geocoding provider timed out');
    this.name = 'GeocodingTimeoutError';
  }
}

@Injectable()
export class GeocodingService {
  private readonly timeoutMs: number;
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(GEOCODING_PROVIDER) private readonly provider: GeocodingProvider,
    private readonly redisService: RedisService,
    private readonly logger: StructuredLogger,
    configService: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.timeoutMs = configService.getOrThrow<number>('geocoding.timeoutMs');
    this.cacheTtlSeconds = configService.getOrThrow<number>('geocoding.cacheTtlSeconds');
  }

  async search(query: string, proximity?: GeocodingCoordinates): Promise<GeocodingPlace[]> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    if (normalizedQuery.length < 2 || normalizedQuery.length > 200) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'q must contain between 2 and 200 characters',
      );
    }
    if (proximity) this.validateCoordinates(proximity);
    const proximityKey = proximity
      ? `:${proximity.latitude.toFixed(3)},${proximity.longitude.toFixed(3)}`
      : '';
    const cacheKey = this.cacheKey('search', `${normalizedQuery.toLowerCase()}${proximityKey}`);
    const cached = await this.readCache<GeocodingPlace[]>(cacheKey);
    if (cached) return cached;

    const result = await this.callProvider('search', (signal) =>
      this.provider.search(normalizedQuery, { signal, proximity }),
    );
    if (result.length > 50) {
      throw new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Geocoding provider returned too many locations',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const normalized = result.map((place) => this.validatePlace(place));
    await this.writeCache(cacheKey, normalized);
    return normalized;
  }

  async resolvePlace(providerPlaceId: string): Promise<GeocodingPlace> {
    const normalizedId = providerPlaceId.trim();
    if (!normalizedId || normalizedId.length > 255) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'providerPlaceId is invalid');
    }
    const cacheKey = this.cacheKey('place', normalizedId);
    const cached = await this.readCache<GeocodingPlace>(cacheKey);
    if (cached) return cached;

    const place = await this.callProvider('resolve', (signal) =>
      this.provider.resolvePlace(normalizedId, { signal }),
    );
    if (!place) throw new NotFoundException('Location was not found');
    const normalized = this.validatePlace(place);
    await this.writeCache(cacheKey, normalized);
    return normalized;
  }

  async reverseGeocode(coordinates: GeocodingCoordinates): Promise<GeocodingPlace> {
    this.validateCoordinates(coordinates);
    const cacheKey = this.cacheKey(
      'reverse',
      `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`,
    );
    const cached = await this.readCache<GeocodingPlace>(cacheKey);
    if (cached) return cached;

    const place = await this.callProvider('reverse', (signal) =>
      this.provider.reverseGeocode(coordinates, { signal }),
    );
    if (!place) throw new NotFoundException('Location was not found');
    const normalized = this.validatePlace(place);
    await this.writeCache(cacheKey, normalized);
    return normalized;
  }

  private async callProvider<T>(
    operationName: 'search' | 'resolve' | 'reverse',
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    const startedAt = Date.now();
    try {
      const providerPromise = operation(controller.signal);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new GeocodingTimeoutError());
        }, this.timeoutMs);
      });
      const result = await Promise.race([providerPromise, timeoutPromise]);
      this.metrics?.increment('geocoding_provider_requests_total', {
        provider: this.provider.name,
        operation: operationName,
        result: 'success',
      });
      this.metrics?.observe('geocoding_provider_latency_ms', Date.now() - startedAt, {
        provider: this.provider.name,
        operation: operationName,
      });
      return result;
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      this.logger.error(
        { provider: this.provider.name, timeout: error instanceof GeocodingTimeoutError },
        error instanceof Error ? error.stack : undefined,
        'GeocodingService.providerFailure',
      );
      this.metrics?.increment('geocoding_provider_requests_total', {
        provider: this.provider.name,
        operation: operationName,
        result: 'failure',
      });
      this.metrics?.observe('geocoding_provider_latency_ms', Date.now() - startedAt, {
        provider: this.provider.name,
        operation: operationName,
      });
      if (
        error instanceof GeocodingTimeoutError ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new ApplicationError(
          ErrorCodes.DependencyUnavailable,
          'Geocoding provider timed out',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Geocoding provider is temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private validatePlace(place: GeocodingPlace): GeocodingPlace {
    if (
      !place ||
      typeof place.providerPlaceId !== 'string' ||
      !place.providerPlaceId.trim() ||
      typeof place.name !== 'string' ||
      !place.name.trim() ||
      typeof place.formattedAddress !== 'string' ||
      !place.formattedAddress.trim()
    ) {
      throw new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Geocoding provider returned an invalid location',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    this.validateCoordinates(place.coordinates);
    const locality = this.normalizeLocality(place.locality);
    return {
      providerPlaceId: place.providerPlaceId.trim().slice(0, 255),
      name: place.name.trim().slice(0, 200),
      formattedAddress: place.formattedAddress.trim().slice(0, 500),
      coordinates: {
        longitude: place.coordinates.longitude,
        latitude: place.coordinates.latitude,
      },
      ...(locality ? { locality } : {}),
    };
  }

  private normalizeLocality(placeLocality: GeocodingPlace['locality']): GeocodingPlace['locality'] {
    if (!placeLocality) return undefined;
    const fields = ['countryCode', 'country', 'region', 'city', 'district'] as const;
    const locality = Object.fromEntries(
      fields.flatMap((field) => {
        const value = placeLocality[field];
        return typeof value === 'string' && value.trim()
          ? [[field, value.trim().slice(0, field === 'countryCode' ? 8 : 120)]]
          : [];
      }),
    ) as NonNullable<GeocodingPlace['locality']>;
    return Object.keys(locality).length > 0 ? locality : undefined;
  }

  private validateCoordinates(coordinates: GeocodingCoordinates): void {
    if (
      !coordinates ||
      !Number.isFinite(coordinates.longitude) ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180 ||
      !Number.isFinite(coordinates.latitude) ||
      coordinates.latitude < -90 ||
      coordinates.latitude > 90
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'coordinates are invalid');
    }
  }

  private cacheKey(operation: string, value: string): string {
    return `geocoding:v1:${this.provider.name}:${operation}:${createHash('sha256')
      .update(value)
      .digest('hex')}`;
  }

  private async readCache<T>(key: string): Promise<T | null> {
    if (this.cacheTtlSeconds <= 0) return null;
    try {
      const value = await this.redisService.getClient().get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.warn(
        { key, error: error instanceof Error ? error.message : 'unknown' },
        'GeocodingService.cacheRead',
      );
      return null;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    if (this.cacheTtlSeconds <= 0) return;
    try {
      await this.redisService
        .getClient()
        .set(key, JSON.stringify(value), 'EX', this.cacheTtlSeconds);
    } catch (error) {
      this.logger.warn(
        { key, error: error instanceof Error ? error.message : 'unknown' },
        'GeocodingService.cacheWrite',
      );
    }
  }
}

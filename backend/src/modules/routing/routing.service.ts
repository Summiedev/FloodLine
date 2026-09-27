import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RouteRiskService } from './route-risk.service';
import { RouteRecommendationPolicy } from './route-recommendation.policy';
import type {
  RouteCandidate,
  RouteCoordinate,
  RoutePreviewResponse,
  RoutePreviewRoute,
  RoutingProvider,
  RoutingRequest,
} from './routing.types';
import { ROUTING_PROVIDER } from './routing.types';

class RoutingTimeoutError extends Error {
  constructor() {
    super('Routing provider timed out');
    this.name = 'RoutingTimeoutError';
  }
}

@Injectable()
export class RoutingService {
  private readonly timeoutMs: number;
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(ROUTING_PROVIDER) private readonly provider: RoutingProvider,
    private readonly routeRiskService: RouteRiskService,
    private readonly recommendationPolicy: RouteRecommendationPolicy,
    private readonly redisService: RedisService,
    private readonly logger: StructuredLogger,
    configService: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.timeoutMs = configService.getOrThrow<number>('routing.timeoutMs');
    this.cacheTtlSeconds = configService.getOrThrow<number>('routing.cacheTtlSeconds');
  }

  async preview(
    input: RoutingRequest,
    options: { bypassCache?: boolean } = {},
  ): Promise<RoutePreviewResponse> {
    this.validateRequest(input);
    const cacheKey = this.cacheKey(input);
    const cached = options.bypassCache ? null : await this.readCache(cacheKey);
    if (cached) {
      this.metrics?.increment('routing_provider_requests_total', {
        provider: this.provider.name,
        result: 'cache_hit',
      });
      this.logger.log(
        { provider: this.provider.name, cached: true, routeCount: cached.routes.length },
        'RoutingService.preview',
      );
      return cached;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    try {
      const routePromise = this.provider.route(input, controller.signal);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new RoutingTimeoutError());
        }, this.timeoutMs);
      });
      const candidates = await Promise.race([routePromise, timeoutPromise]);
      const normalized = candidates.map((candidate) => this.validateCandidate(candidate, input));
      const routes: RoutePreviewRoute[] = await Promise.all(
        normalized.map(async (candidate) => ({
          id: candidate.fingerprint,
          routeId: candidate.fingerprint,
          geometry: candidate.geometry,
          polyline: candidate.polyline,
          distanceMeters: candidate.distanceMeters,
          durationSeconds: candidate.durationSeconds,
          travelMode: candidate.travelMode,
          risk: await this.routeRiskService.evaluate(candidate.geometry),
          recommended: false,
          recommendationReason: null,
        })),
      );
      const response = this.recommendationPolicy.recommend(routes);
      await this.writeCache(cacheKey, response);
      const durationMs = Date.now() - startedAt;
      this.metrics?.increment('routing_provider_requests_total', {
        provider: this.provider.name,
        result: 'success',
      });
      this.metrics?.observe('routing_provider_latency_ms', durationMs, {
        provider: this.provider.name,
      });
      this.logger.log(
        {
          provider: this.provider.name,
          cached: false,
          routeCount: routes.length,
          durationMs: Date.now() - startedAt,
          travelMode: input.travelMode,
        },
        'RoutingService.preview',
      );
      return response;
    } catch (error) {
      this.logger.error(
        {
          provider: this.provider.name,
          durationMs: Date.now() - startedAt,
          failure: true,
          timeout: error instanceof RoutingTimeoutError,
        },
        error instanceof Error ? error.stack : undefined,
        'RoutingService.preview',
      );
      this.metrics?.increment('routing_provider_requests_total', {
        provider: this.provider.name,
        result: 'failure',
      });
      this.metrics?.observe('routing_provider_latency_ms', Date.now() - startedAt, {
        provider: this.provider.name,
      });
      throw this.toApplicationError(error);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private validateRequest(input: RoutingRequest): void {
    this.validateCoordinate(input.origin, 'origin');
    this.validateCoordinate(input.destination, 'destination');
    if ((input.waypoints ?? []).length > 20) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'A maximum of 20 waypoints is allowed',
      );
    }
    for (const [index, waypoint] of (input.waypoints ?? []).entries()) {
      this.validateCoordinate(waypoint, `waypoints[${index}]`);
    }
    if (!this.provider.supportedTravelModes.includes(input.travelMode)) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        `Travel mode ${input.travelMode} is not supported by the configured routing provider`,
      );
    }
  }

  private validateCoordinate(coordinate: RouteCoordinate, name: string): void {
    if (
      !Number.isFinite(coordinate.longitude) ||
      coordinate.longitude < -180 ||
      coordinate.longitude > 180
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${name}.longitude is invalid`);
    }
    if (
      !Number.isFinite(coordinate.latitude) ||
      coordinate.latitude < -90 ||
      coordinate.latitude > 90
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${name}.latitude is invalid`);
    }
  }

  private validateCandidate(candidate: RouteCandidate, request: RoutingRequest): RouteCandidate {
    if (
      !candidate ||
      !candidate.providerRouteId ||
      !candidate.fingerprint ||
      candidate.travelMode !== request.travelMode ||
      !Number.isFinite(candidate.distanceMeters) ||
      candidate.distanceMeters < 0 ||
      !Number.isFinite(candidate.durationSeconds) ||
      candidate.durationSeconds <= 0 ||
      !candidate.geometry ||
      candidate.geometry.type !== 'LineString' ||
      !Array.isArray(candidate.geometry.coordinates) ||
      candidate.geometry.coordinates.length < 2 ||
      candidate.geometry.coordinates.length > 10_000
    ) {
      throw new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Routing provider returned an invalid route',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    for (const coordinate of candidate.geometry.coordinates) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        throw new ApplicationError(
          ErrorCodes.DependencyUnavailable,
          'Routing provider returned invalid geometry',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      const [longitude, latitude] = coordinate;
      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new ApplicationError(
          ErrorCodes.DependencyUnavailable,
          'Routing provider returned invalid geometry',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
    return candidate;
  }

  private toApplicationError(error: unknown): ApplicationError {
    if (error instanceof ApplicationError) return error;
    if (
      error instanceof RoutingTimeoutError ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      return new ApplicationError(
        ErrorCodes.DependencyUnavailable,
        'Routing provider timed out',
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
    return new ApplicationError(
      ErrorCodes.DependencyUnavailable,
      'Routing provider is temporarily unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private cacheKey(input: RoutingRequest): string {
    const normalized = JSON.stringify({
      origin: input.origin,
      destination: input.destination,
      waypoints: input.waypoints ?? [],
      travelMode: input.travelMode,
    });
    return `routing:preview:v2:${createHash('sha256').update(normalized).digest('hex')}`;
  }

  private async readCache(key: string): Promise<RoutePreviewResponse | null> {
    if (this.cacheTtlSeconds <= 0) return null;
    try {
      const cached = await this.redisService.getClient().get(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as RoutePreviewResponse;
      return parsed.routes ? parsed : null;
    } catch (error) {
      this.logger.warn(
        { key, error: error instanceof Error ? error.message : 'unknown' },
        'RoutingService.cacheRead',
      );
      return null;
    }
  }

  private async writeCache(key: string, response: RoutePreviewResponse): Promise<void> {
    if (this.cacheTtlSeconds <= 0) return;
    try {
      await this.redisService
        .getClient()
        .set(key, JSON.stringify(response), 'EX', this.cacheTtlSeconds);
    } catch (error) {
      this.logger.warn(
        { key, error: error instanceof Error ? error.message : 'unknown' },
        'RoutingService.cacheWrite',
      );
    }
  }
}

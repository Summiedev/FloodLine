import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  TravelMode,
  type RouteCandidate,
  type RoutingProvider,
  type RoutingRequest,
} from './routing.types';

interface MapboxRouteResponse {
  code?: unknown;
  routes?: unknown;
}

interface MapboxRoute {
  distance?: unknown;
  duration?: unknown;
  geometry?: { type?: unknown; coordinates?: unknown };
}

/**
 * Mapbox Directions v5 adapter. The access token stays on the server and is
 * deliberately never returned through FloodLine's public route DTOs.
 */
@Injectable()
export class MapboxRoutingProvider implements RoutingProvider {
  readonly name = 'mapbox';
  readonly supportedTravelModes = [
    TravelMode.DRIVING,
    TravelMode.CYCLING,
    TravelMode.WALKING,
  ] as const;

  private readonly accessToken?: string;
  private readonly drivingProfile: 'mapbox/driving' | 'mapbox/driving-traffic';

  constructor(configService: ConfigService) {
    this.accessToken = configService.get<string>('routing.mapboxAccessToken');
    this.drivingProfile =
      configService.get<'mapbox/driving' | 'mapbox/driving-traffic'>(
        'routing.mapboxDrivingProfile',
      ) ?? 'mapbox/driving-traffic';
  }

  assertConfigured(): void {
    if (!this.accessToken) throw new Error('Mapbox routing is missing its access token');
  }

  async route(request: RoutingRequest, signal?: AbortSignal): Promise<RouteCandidate[]> {
    this.assertConfigured();
    const profile = this.profileFor(request.travelMode);
    const points = [request.origin, ...(request.waypoints ?? []), request.destination];
    const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(';');
    const query = new URLSearchParams({
      access_token: this.accessToken as string,
      alternatives: 'true',
      geometries: 'geojson',
      overview: 'full',
      steps: 'false',
    });
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?${query.toString()}`,
      { signal, headers: { accept: 'application/json' } },
    );
    if (!response.ok)
      throw new Error(`Mapbox Directions request failed with status ${response.status}`);
    const payload = (await response.json()) as MapboxRouteResponse;
    if (payload.code !== 'Ok' || !Array.isArray(payload.routes)) {
      throw new Error('Mapbox Directions returned no usable route');
    }

    const routes = payload.routes
      .map((route) => this.normalizeRoute(route as MapboxRoute, request.travelMode))
      .filter((route): route is RouteCandidate => route !== null);
    if (routes.length === 0) throw new Error('Mapbox Directions returned no usable route');
    return routes;
  }

  private profileFor(mode: TravelMode): string {
    switch (mode) {
      case TravelMode.DRIVING:
        return this.drivingProfile;
      case TravelMode.CYCLING:
        return 'mapbox/cycling';
      case TravelMode.WALKING:
        return 'mapbox/walking';
      case TravelMode.TRANSIT:
        throw new Error('Mapbox Directions does not support transit routes');
    }
  }

  private normalizeRoute(route: MapboxRoute, travelMode: TravelMode): RouteCandidate | null {
    const coordinates = route.geometry?.coordinates;
    if (
      route.geometry?.type !== 'LineString' ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration)
    ) {
      return null;
    }
    const line = coordinates.map((coordinate) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        !Number.isFinite(coordinate[0]) ||
        !Number.isFinite(coordinate[1])
      ) {
        return null;
      }
      return [Number(coordinate[0]), Number(coordinate[1])] as [number, number];
    });
    if (line.some((coordinate) => coordinate === null)) return null;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          geometry: line,
          distance: route.distance,
          duration: route.duration,
          travelMode,
        }),
      )
      .digest('hex');
    return {
      providerRouteId: `mapbox-${fingerprint.slice(0, 24)}`,
      fingerprint,
      geometry: { type: 'LineString', coordinates: line as Array<[number, number]> },
      polyline: null,
      distanceMeters: Math.round(Number(route.distance) * 100) / 100,
      durationSeconds: Math.max(1, Math.round(Number(route.duration))),
      travelMode,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  RouteCandidate,
  RouteCoordinate,
  RoutingProvider,
  RoutingRequest,
} from './routing.types';
import { TravelMode } from './routing.types';

/**
 * Deterministic development provider. It creates a straight-line approximation and must not be
 * presented as turn-by-turn navigation. A production road-network adapter can replace this token.
 */
@Injectable()
export class LocalRoutingProvider implements RoutingProvider {
  readonly name = 'local-development';
  readonly supportedTravelModes = Object.values(TravelMode);

  route(request: RoutingRequest, signal?: AbortSignal): Promise<RouteCandidate[]> {
    if (signal?.aborted) {
      throw new DOMException('Routing request aborted', 'AbortError');
    }

    const points = [request.origin, ...(request.waypoints ?? []), request.destination];
    const distanceMeters = points
      .slice(1)
      .reduce((total, point, index) => total + haversineMeters(points[index], point), 0);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ points, travelMode: request.travelMode }))
      .digest('hex');

    return Promise.resolve([
      {
        providerRouteId: `local-${fingerprint.slice(0, 16)}`,
        fingerprint,
        geometry: {
          type: 'LineString',
          coordinates: points.map((point) => [point.longitude, point.latitude]),
        },
        polyline: null,
        distanceMeters: Math.round(distanceMeters * 100) / 100,
        durationSeconds: Math.max(
          1,
          Math.round(distanceMeters / metersPerSecond(request.travelMode)),
        ),
        travelMode: request.travelMode,
      },
    ]);
  }
}

function metersPerSecond(mode: TravelMode): number {
  switch (mode) {
    case TravelMode.WALKING:
      return 1.4;
    case TravelMode.CYCLING:
      return 4.2;
    case TravelMode.TRANSIT:
      return 5.5;
    case TravelMode.DRIVING:
      return 8.3;
  }
}

function haversineMeters(a: RouteCoordinate, b: RouteCoordinate): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

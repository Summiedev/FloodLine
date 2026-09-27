export const ROUTING_PROVIDER = Symbol('ROUTING_PROVIDER');

export enum TravelMode {
  DRIVING = 'DRIVING',
  TRANSIT = 'TRANSIT',
  CYCLING = 'CYCLING',
  WALKING = 'WALKING',
}

export interface RouteCoordinate {
  longitude: number;
  latitude: number;
}

export interface RoutingRequest {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  travelMode: TravelMode;
  waypoints?: RouteCoordinate[];
}

export interface RouteLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

/** Normalized provider output. Provider-specific metadata remains internal. */
export interface RouteCandidate {
  providerRouteId: string;
  fingerprint: string;
  geometry: RouteLineString;
  polyline: string | null;
  distanceMeters: number;
  durationSeconds: number;
  travelMode: TravelMode;
  providerMetadata?: Record<string, unknown> | null;
}

export interface RoutingProvider {
  readonly name: string;
  readonly supportedTravelModes: readonly TravelMode[];
  route(request: RoutingRequest, signal?: AbortSignal): Promise<RouteCandidate[]>;
}

export type RouteRiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type RouteRecommendationReason =
  'LOWER_REPORTED_FLOOD_RISK' | 'FASTEST_AVAILABLE_ROUTE' | 'LOWEST_COMBINED_ROUTE_COST';

export interface RouteRiskIncidentSummary {
  id: string;
  incidentType: string;
  severity: string;
  confidenceLabel: string;
  sourceType: string;
  locationName: string;
  distanceMeters: number;
  updatedAt: Date;
}

export interface RouteRiskResult {
  riskScore: number;
  riskLevel: RouteRiskLevel;
  affectingIncidentCount: number;
  severeIncidentCount: number;
  avoidedIncidentCount: number | null;
  incidents: RouteRiskIncidentSummary[];
  summary: 'Lower reported flood risk' | 'Flood reports detected' | 'No currently known reports';
}

export interface RoutePreviewRoute {
  id: string;
  routeId: string;
  geometry: RouteLineString;
  polyline: string | null;
  distanceMeters: number;
  durationSeconds: number;
  travelMode: TravelMode;
  risk: RouteRiskResult;
  recommended: boolean;
  recommendationReason: RouteRecommendationReason | null;
}

export interface RoutePreviewResponse {
  routes: RoutePreviewRoute[];
}

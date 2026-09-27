import type {
  RouteCoordinate,
  RouteLineString,
  RoutePreviewRoute,
  RouteRiskLevel,
  TravelMode,
} from '../routing/routing.types';

export type NavigationSessionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface NavigationSessionStartInput {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  travelMode: TravelMode;
  route: {
    id?: string;
    geometry: RouteLineString;
    distanceMeters: number;
    durationSeconds: number;
  };
}

export interface NavigationSessionCreateInput {
  userId: string;
  routeFingerprint: string;
  routeGeometry: RouteLineString;
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  travelMode: TravelMode;
  routeDistanceMeters: number;
  routeDurationSeconds: number;
  currentRiskScore: number;
  currentRiskLevel: RouteRiskLevel;
  currentAffectingIncidentCount: number;
  currentSevereIncidentCount: number;
  expiresAt: Date;
}

export interface NavigationSessionRecord extends NavigationSessionCreateInput {
  id: string;
  status: NavigationSessionStatus;
  startedAt: Date;
  lastRouteUpdateAt: Date;
  lastReroutedAt: Date | null;
  updates: NavigationRouteUpdateRecord[];
}

export interface NavigationRouteUpdateRecord {
  id: string;
  sessionId: string;
  userId: string;
  triggeringIncidentId: string;
  triggeringIncidentLocationName: string;
  previousRouteFingerprint: string;
  newRouteFingerprint: string;
  previousRiskScore: number | null;
  newRiskScore: number;
  reason: string;
  route: Pick<
    RoutePreviewRoute,
    'id' | 'geometry' | 'distanceMeters' | 'durationSeconds' | 'travelMode' | 'risk'
  >;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: Date;
  sentAt: Date | null;
}

export interface NavigationRouteUpdateEvent {
  updateId: string;
  userId: string;
  sessionId: string;
  title: 'Route updated';
  body: string;
  route: NavigationRouteUpdateRecord['route'];
}

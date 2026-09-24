import type {
  IncidentConfidenceLabel,
  IncidentSeverity,
  IncidentSourceType,
  IncidentStatus,
  IncidentType,
} from '@prisma/client';

export interface Coordinate {
  longitude: number;
  latitude: number;
}

export interface IncidentFilters {
  bbox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  center?: Coordinate & { radiusMeters: number };
  incidentType?: IncidentType;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  updatedSince?: Date;
  page: number;
  pageSize: number;
}

export interface CreateIncidentCommand {
  incidentType: IncidentType;
  severity: IncidentSeverity;
  location: Coordinate;
  locationName: string;
  description: string;
  sourceType: IncidentSourceType;
  firstReportedAt?: Date;
  expiresAt?: Date | null;
}

export interface UpdateIncidentCommand {
  incidentType?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  location?: Coordinate;
  locationName?: string;
  description?: string;
  expiresAt?: Date | null;
  resolvedAt?: Date | null;
}

export interface ConfidenceValue {
  score: number;
  label: IncidentConfidenceLabel;
}

export interface RawIncidentRow {
  id: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  longitude: number;
  latitude: number;
  affectedGeometry: string | null;
  locationName: string;
  description: string;
  confidenceScore: number;
  confidenceLabel: IncidentConfidenceLabel;
  sourceType: IncidentSourceType;
  confirmationCount: number;
  photoCount: number;
  firstReportedAt: Date;
  lastConfirmedAt: Date | null;
  resolvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  distanceMeters: number | null;
}

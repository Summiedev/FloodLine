import type {
  IncidentConfidenceLabel,
  IncidentSeverity,
  IncidentSourceType,
  IncidentStatus,
  IncidentType,
} from '@prisma/client';

export interface IncidentResponseDto {
  id: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: {
    longitude: number;
    latitude: number;
    srid: 4326;
  };
  affectedGeometry: Record<string, unknown> | null;
  locationName: string;
  description: string;
  confidence: {
    score: number;
    label: IncidentConfidenceLabel;
  };
  sourceType: IncidentSourceType;
  confirmationCount: number;
  photoCount: number;
  firstReportedAt: Date;
  lastConfirmedAt: Date | null;
  resolvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  distanceMeters?: number;
}

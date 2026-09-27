import type {
  IncidentConfidenceLabel,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from '@prisma/client';

export interface MapIncidentFilters {
  north: number;
  south: number;
  east: number;
  west: number;
  incidentTypes?: IncidentType[];
  updatedSince?: Date;
  limit: number;
}

export interface MapIncidentMarker {
  id: string;
  coordinates: { longitude: number; latitude: number; srid: 4326 };
  incidentType: IncidentType;
  severity: IncidentSeverity;
  confidenceLabel: IncidentConfidenceLabel;
  status: IncidentStatus;
  updatedAt: Date;
  clustered: false;
  clusterId: null;
  pointCount: 1;
}

export interface MapIncidentFeedResponse {
  data: MapIncidentMarker[];
  meta: {
    count: number;
    limit: number;
    truncated: boolean;
    datelineCrossing: boolean;
    updatedSince: string | null;
    nextUpdatedSince: string;
    clustering: 'client-ready';
  };
}

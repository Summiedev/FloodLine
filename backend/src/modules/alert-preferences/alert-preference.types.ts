import type { IncidentType } from '@prisma/client';

export const ALERTABLE_INCIDENT_TYPES: readonly IncidentType[] = [
  'SEVERE_FLOODING',
  'MODERATE_FLOODING',
  'BLOCKED_ROAD',
  'BLOCKED_DRAIN',
];

export const REQUIRED_ALERT_INCIDENT_TYPE: IncidentType = 'SEVERE_FLOODING';

export interface AlertPreferenceRecord {
  id: string;
  userId: string;
  savedPlaceId: string | null;
  radiusMeters: number;
  incidentTypes: IncidentType[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertPreferenceResponse {
  savedPlaceId: string | null;
  radiusMeters: number;
  incidentTypes: IncidentType[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertPreferenceUpdateInput {
  radiusMeters?: number;
  incidentTypes?: IncidentType[];
}

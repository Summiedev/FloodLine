import type { FloodReportWaterLevelCategory, IncidentSeverity, IncidentType } from '@prisma/client';
import type { IncidentResponseDto } from '../incidents/incident-response.dto';

export interface FloodReportSubmission {
  reporterUserId: string;
  reportType: IncidentType;
  longitude: number;
  latitude: number;
  locationName: string;
  description: string;
  observedSeverity: IncidentSeverity;
  waterLevelCategory?: FloodReportWaterLevelCategory;
  occurredAt?: Date;
}

export interface FloodReportCreateRecord extends FloodReportSubmission {
  id: string;
  incidentId: string;
  sourceMetadata: Record<string, string>;
}

export interface FloodReportCreatedJobPayload {
  reportId: string;
  incidentId: string;
  reporterUserId: string;
}

export interface FloodReportSubmissionResult {
  reportId: string;
  incident: IncidentResponseDto;
}

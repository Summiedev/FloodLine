import type { IncidentStatus } from '@prisma/client';
import type { IncidentResponseDto } from '../incidents/incident-response.dto';

export interface LockedIncident {
  id: string;
  status: IncidentStatus;
  expiresAt: Date | null;
  databaseNow: Date;
}

export interface ExistingConfirmation {
  id: string;
  createdAt: Date;
  lastConfirmedAt: Date | null;
}

export interface ConfirmationAggregate {
  confirmationCount: number;
  lastConfirmedAt: Date | null;
}

export interface IncidentConfirmationResult {
  incident: IncidentResponseDto;
  confirmationId: string;
  confirmedAt: Date;
  eventRequired: boolean;
}

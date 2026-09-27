import type { IncidentSeverity, NotificationType } from '@prisma/client';

export interface AlertHistoryResponse {
  id: string;
  category: NotificationType;
  severity: IncidentSeverity;
  incidentId: string | null;
  officialWarningId: string | null;
  savedPlaceId: string | null;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

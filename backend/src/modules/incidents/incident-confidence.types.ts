import type { IncidentConfidenceLabel, IncidentSourceType } from '@prisma/client';

export interface IncidentConfidenceEvidence {
  sourceType: IncidentSourceType;
  uniqueConfirmations: number;
  recentReports: number;
  recentConfirmations: number;
  distinctReporters: number;
  photoEvidence: number;
  trustedContributorWeight: number;
  officialInformationWeight: number;
  contradictoryReports: number;
  resolutionReports: number;
  incidentAgeHours: number;
}

export interface IncidentConfidenceBreakdown {
  signals: {
    confirmations: number;
    recentReports: number;
    recentConfirmations: number;
    distinctReporters: number;
    photos: number;
    trustedContributors: number;
    officialSource: number;
    contradictoryReports: number;
    resolutionReports: number;
    age: number;
  };
  weightedPositive: number;
  totalPenalty: number;
}

export interface IncidentConfidenceResult {
  score: number;
  label: IncidentConfidenceLabel;
  breakdown: IncidentConfidenceBreakdown;
}

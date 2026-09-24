import { Injectable } from '@nestjs/common';
import { IncidentConfidenceLabel, IncidentSourceType } from '@prisma/client';
import type { ConfidenceValue } from './incident.types';

@Injectable()
export class IncidentConfidencePolicy {
  calculate(sourceType: IncidentSourceType, confirmationCount = 0): ConfidenceValue {
    if (sourceType === IncidentSourceType.OFFICIAL) {
      return { score: 0.95, label: IncidentConfidenceLabel.HIGH };
    }

    if (confirmationCount >= 3) {
      return { score: 0.75, label: IncidentConfidenceLabel.HIGH };
    }

    if (confirmationCount >= 1) {
      return { score: 0.55, label: IncidentConfidenceLabel.MEDIUM };
    }

    return { score: 0.35, label: IncidentConfidenceLabel.LOW };
  }
}

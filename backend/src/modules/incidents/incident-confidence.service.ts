import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentConfidenceLabel, IncidentSourceType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { INCIDENT_CONFIDENCE_RECALCULATE_JOB } from './incident-confidence.constants';
import { IncidentConfidenceRepository } from './incident-confidence.repository';
import type {
  IncidentConfidenceBreakdown,
  IncidentConfidenceEvidence,
  IncidentConfidenceResult,
} from './incident-confidence.types';

interface IncidentConfidenceConfig {
  recentReportWindowHours: number;
  recentConfirmationWindowHours: number;
  staleAgeHours: number;
  maximumConfirmations: number;
  maximumRecentReports: number;
  maximumRecentConfirmations: number;
  maximumDistinctReporters: number;
  maximumPhotos: number;
  maximumContradictoryReports: number;
  maximumResolutionReports: number;
  lowThreshold: number;
  highThreshold: number;
  officialMinimumScore: number;
  weightConfirmations: number;
  weightReportRecency: number;
  weightConfirmationRecency: number;
  weightDistinctReporters: number;
  weightPhotos: number;
  weightTrustedContributors: number;
  weightOfficialSource: number;
  penaltyContradictoryReports: number;
  penaltyResolutionReports: number;
  penaltyAge: number;
}

export interface IncidentConfidenceRecalculationJobPayload {
  incidentId: string;
  reason: string;
}

@Injectable()
export class IncidentConfidenceService {
  private readonly config: IncidentConfidenceConfig;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly repository: IncidentConfidenceRepository,
    private readonly queueService: QueueService,
  ) {
    this.config = {
      recentReportWindowHours: configService.getOrThrow<number>(
        'incidentConfidence.recentReportWindowHours',
      ),
      recentConfirmationWindowHours: configService.getOrThrow<number>(
        'incidentConfidence.recentConfirmationWindowHours',
      ),
      staleAgeHours: configService.getOrThrow<number>('incidentConfidence.staleAgeHours'),
      maximumConfirmations: configService.getOrThrow<number>(
        'incidentConfidence.maximumConfirmations',
      ),
      maximumRecentReports: configService.getOrThrow<number>(
        'incidentConfidence.maximumRecentReports',
      ),
      maximumRecentConfirmations: configService.getOrThrow<number>(
        'incidentConfidence.maximumRecentConfirmations',
      ),
      maximumDistinctReporters: configService.getOrThrow<number>(
        'incidentConfidence.maximumDistinctReporters',
      ),
      maximumPhotos: configService.getOrThrow<number>('incidentConfidence.maximumPhotos'),
      maximumContradictoryReports: configService.getOrThrow<number>(
        'incidentConfidence.maximumContradictoryReports',
      ),
      maximumResolutionReports: configService.getOrThrow<number>(
        'incidentConfidence.maximumResolutionReports',
      ),
      lowThreshold: configService.getOrThrow<number>('incidentConfidence.lowThreshold'),
      highThreshold: configService.getOrThrow<number>('incidentConfidence.highThreshold'),
      officialMinimumScore: configService.getOrThrow<number>(
        'incidentConfidence.officialMinimumScore',
      ),
      weightConfirmations: configService.getOrThrow<number>(
        'incidentConfidence.weightConfirmations',
      ),
      weightReportRecency: configService.getOrThrow<number>(
        'incidentConfidence.weightReportRecency',
      ),
      weightConfirmationRecency: configService.getOrThrow<number>(
        'incidentConfidence.weightConfirmationRecency',
      ),
      weightDistinctReporters: configService.getOrThrow<number>(
        'incidentConfidence.weightDistinctReporters',
      ),
      weightPhotos: configService.getOrThrow<number>('incidentConfidence.weightPhotos'),
      weightTrustedContributors: configService.getOrThrow<number>(
        'incidentConfidence.weightTrustedContributors',
      ),
      weightOfficialSource: configService.getOrThrow<number>(
        'incidentConfidence.weightOfficialSource',
      ),
      penaltyContradictoryReports: configService.getOrThrow<number>(
        'incidentConfidence.penaltyContradictoryReports',
      ),
      penaltyResolutionReports: configService.getOrThrow<number>(
        'incidentConfidence.penaltyResolutionReports',
      ),
      penaltyAge: configService.getOrThrow<number>('incidentConfidence.penaltyAge'),
    };
  }

  /**
   * Transparent evidence model. The score expresses confidence in the
   * evidence that an incident exists; it is not a guarantee of physical safety.
   */
  calculate(evidence: IncidentConfidenceEvidence): IncidentConfidenceResult {
    const signals = {
      confirmations: this.normalize(evidence.uniqueConfirmations, this.config.maximumConfirmations),
      recentReports: this.normalize(evidence.recentReports, this.config.maximumRecentReports),
      recentConfirmations: this.normalize(
        evidence.recentConfirmations,
        this.config.maximumRecentConfirmations,
      ),
      distinctReporters: this.normalize(
        evidence.distinctReporters,
        this.config.maximumDistinctReporters,
      ),
      photos: this.normalize(evidence.photoEvidence, this.config.maximumPhotos),
      trustedContributors: this.clamp(evidence.trustedContributorWeight),
      officialSource: this.clamp(
        Math.max(
          evidence.sourceType === IncidentSourceType.OFFICIAL ? 1 : 0,
          evidence.officialInformationWeight,
        ),
      ),
      contradictoryReports: this.normalize(
        evidence.contradictoryReports,
        this.config.maximumContradictoryReports,
      ),
      resolutionReports: this.normalize(
        evidence.resolutionReports,
        this.config.maximumResolutionReports,
      ),
      age: this.normalize(evidence.incidentAgeHours, this.config.staleAgeHours),
    };

    const positiveWeights = [
      this.config.weightConfirmations,
      this.config.weightReportRecency,
      this.config.weightConfirmationRecency,
      this.config.weightDistinctReporters,
      this.config.weightPhotos,
      this.config.weightTrustedContributors,
      this.config.weightOfficialSource,
    ];
    const positiveWeightTotal = positiveWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    const weightedPositive =
      (signals.confirmations * this.config.weightConfirmations +
        signals.recentReports * this.config.weightReportRecency +
        signals.recentConfirmations * this.config.weightConfirmationRecency +
        signals.distinctReporters * this.config.weightDistinctReporters +
        signals.photos * this.config.weightPhotos +
        signals.trustedContributors * this.config.weightTrustedContributors +
        signals.officialSource * this.config.weightOfficialSource) /
      positiveWeightTotal;
    const totalPenalty =
      signals.contradictoryReports * this.config.penaltyContradictoryReports +
      signals.resolutionReports * this.config.penaltyResolutionReports +
      signals.age * this.config.penaltyAge;

    const confidenceBase =
      evidence.sourceType === IncidentSourceType.OFFICIAL
        ? Math.max(weightedPositive, this.config.officialMinimumScore)
        : weightedPositive;
    let score = this.clamp(confidenceBase - totalPenalty);
    score = this.round(score);

    return {
      score,
      label:
        score >= this.config.highThreshold
          ? IncidentConfidenceLabel.HIGH
          : score >= this.config.lowThreshold
            ? IncidentConfidenceLabel.MEDIUM
            : IncidentConfidenceLabel.LOW,
      breakdown: {
        signals,
        weightedPositive: this.round(weightedPositive),
        totalPenalty: this.round(totalPenalty),
      } satisfies IncidentConfidenceBreakdown,
    };
  }

  async recalculateIncident(incidentId: string): Promise<IncidentConfidenceResult> {
    this.assertUuid(incidentId);

    return this.prisma.$transaction(async (transaction) => {
      const evidence = await this.repository.getEvidence(
        transaction,
        incidentId,
        this.config.recentReportWindowHours,
        this.config.recentConfirmationWindowHours,
      );
      if (!evidence) {
        throw new NotFoundException('Incident not found');
      }

      const result = this.calculate(evidence);
      await this.repository.updateConfidence(transaction, incidentId, result.score, result.label);
      return result;
    });
  }

  /** Queue entry point for moderation and official-information integrations. */
  async requestRecalculation(
    incidentId: string,
    reason: string,
    eventId: string = randomUUID(),
  ): Promise<void> {
    this.assertUuid(incidentId);
    const safeReason = reason.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 80) || 'unspecified';
    const safeEventId = eventId.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 80) || randomUUID();
    await this.queueService.enqueueSystemJob<IncidentConfidenceRecalculationJobPayload>(
      INCIDENT_CONFIDENCE_RECALCULATE_JOB,
      { incidentId, reason: safeReason },
      {
        // Callers can pass a domain-event ID for enqueue deduplication. A
        // fresh default keeps separate moderation changes from being lost.
        jobId: `incident-confidence-${incidentId}-${safeReason}-${safeEventId}`,
        attempts: 3,
        backoffMs: 1_000,
      },
    );
  }

  private normalize(value: number, maximum: number): number {
    return this.clamp(value / maximum);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  }

  private round(value: number): number {
    return Math.round(value * 1_000) / 1_000;
  }

  private assertUuid(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error('incidentId must be a valid UUID');
    }
  }
}

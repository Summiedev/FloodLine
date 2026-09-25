import { IncidentConfidenceLabel, IncidentSourceType } from '@prisma/client';
import type { IncidentConfidenceRepository } from './incident-confidence.repository';
import { IncidentConfidenceService } from './incident-confidence.service';
import type { IncidentConfidenceEvidence } from './incident-confidence.types';

const incidentId = '10000000-0000-4000-8000-000000000001';

function createConfig(): { getOrThrow: jest.Mock } {
  const values: Record<string, number> = {
    'incidentConfidence.recentReportWindowHours': 24,
    'incidentConfidence.recentConfirmationWindowHours': 24,
    'incidentConfidence.staleAgeHours': 72,
    'incidentConfidence.maximumConfirmations': 5,
    'incidentConfidence.maximumRecentReports': 5,
    'incidentConfidence.maximumRecentConfirmations': 5,
    'incidentConfidence.maximumDistinctReporters': 5,
    'incidentConfidence.maximumPhotos': 3,
    'incidentConfidence.maximumContradictoryReports': 2,
    'incidentConfidence.maximumResolutionReports': 2,
    'incidentConfidence.lowThreshold': 0.5,
    'incidentConfidence.highThreshold': 0.75,
    'incidentConfidence.officialMinimumScore': 0.85,
    'incidentConfidence.weightConfirmations': 0.25,
    'incidentConfidence.weightReportRecency': 0.15,
    'incidentConfidence.weightConfirmationRecency': 0.15,
    'incidentConfidence.weightDistinctReporters': 0.15,
    'incidentConfidence.weightPhotos': 0.1,
    'incidentConfidence.weightTrustedContributors': 0.05,
    'incidentConfidence.weightOfficialSource': 0.15,
    'incidentConfidence.penaltyContradictoryReports': 0.1,
    'incidentConfidence.penaltyResolutionReports': 0.2,
    'incidentConfidence.penaltyAge': 0.1,
  };
  return { getOrThrow: jest.fn((key: string) => values[key]) };
}

function createEvidence(
  overrides: Partial<IncidentConfidenceEvidence> = {},
): IncidentConfidenceEvidence {
  return {
    sourceType: IncidentSourceType.COMMUNITY,
    uniqueConfirmations: 0,
    recentReports: 0,
    recentConfirmations: 0,
    distinctReporters: 0,
    photoEvidence: 0,
    trustedContributorWeight: 0,
    officialInformationWeight: 0,
    contradictoryReports: 0,
    resolutionReports: 0,
    incidentAgeHours: 0,
    ...overrides,
  };
}

function createService() {
  type TransactionCallback = (value: unknown) => unknown;
  const transactionMock = jest.fn<Promise<unknown>, [TransactionCallback]>();
  const prisma = {
    $transaction: transactionMock,
  };
  const repositoryMock = {
    getEvidence: jest.fn(),
    updateConfidence: jest.fn(),
  };
  const repository = repositoryMock as unknown as IncidentConfidenceRepository;
  const queueService = { enqueueSystemJob: jest.fn() };
  const service = new IncidentConfidenceService(
    createConfig() as never,
    prisma as never,
    repository,
    queueService as never,
  );
  return { service, prisma, repositoryMock, queueService };
}

describe('IncidentConfidenceService', () => {
  it('returns low confidence when no evidence exists', () => {
    const { service } = createService();

    expect(service.calculate(createEvidence())).toMatchObject({
      score: 0,
      label: IncidentConfidenceLabel.LOW,
    });
  });

  it('reaches high confidence from independently corroborating evidence', () => {
    const { service } = createService();

    const result = service.calculate(
      createEvidence({
        uniqueConfirmations: 5,
        recentReports: 5,
        recentConfirmations: 5,
        distinctReporters: 5,
        photoEvidence: 3,
        trustedContributorWeight: 1,
      }),
    );

    expect(result.label).toBe(IncidentConfidenceLabel.HIGH);
    expect(result.score).toBe(0.85);
    expect(result.breakdown.signals.confirmations).toBe(1);
  });

  it('applies contradiction, resolution, and age penalties', () => {
    const { service } = createService();

    const result = service.calculate(
      createEvidence({
        uniqueConfirmations: 5,
        recentReports: 5,
        recentConfirmations: 5,
        distinctReporters: 5,
        photoEvidence: 3,
        trustedContributorWeight: 1,
        contradictoryReports: 2,
        resolutionReports: 2,
        incidentAgeHours: 72,
      }),
    );

    expect(result.score).toBe(0.45);
    expect(result.label).toBe(IncidentConfidenceLabel.LOW);
    expect(result.breakdown.totalPenalty).toBe(0.4);
  });

  it('gives official source evidence its documented minimum confidence', () => {
    const { service } = createService();

    const result = service.calculate(createEvidence({ sourceType: IncidentSourceType.OFFICIAL }));

    expect(result.score).toBe(0.85);
    expect(result.label).toBe(IncidentConfidenceLabel.HIGH);
    expect(result.breakdown.signals.officialSource).toBe(1);
  });

  it('allows contradictory evidence to reduce even an official-source score', () => {
    const { service } = createService();

    const result = service.calculate(
      createEvidence({
        sourceType: IncidentSourceType.OFFICIAL,
        contradictoryReports: 2,
        resolutionReports: 2,
        incidentAgeHours: 72,
      }),
    );

    expect(result.score).toBe(0.45);
    expect(result.label).toBe(IncidentConfidenceLabel.LOW);
  });

  it('recalculates and persists confidence inside a transaction', async () => {
    const { service, prisma, repositoryMock } = createService();
    const transaction = {};
    repositoryMock.getEvidence.mockResolvedValue(
      createEvidence({
        recentReports: 5,
        recentConfirmations: 5,
        distinctReporters: 5,
        photoEvidence: 3,
      }),
    );
    prisma.$transaction.mockImplementation((callback) => Promise.resolve(callback(transaction)));

    const result = await service.recalculateIncident(incidentId);

    expect(result.label).toBe(IncidentConfidenceLabel.MEDIUM);
    expect(repositoryMock.getEvidence).toHaveBeenCalledWith(transaction, incidentId, 24, 24);
    expect(repositoryMock.updateConfidence).toHaveBeenCalledWith(
      transaction,
      incidentId,
      result.score,
      result.label,
    );
  });

  it('queues idempotent recalculation work for future integrations', async () => {
    const { service, queueService } = createService();

    await service.requestRecalculation(incidentId, 'moderation changed', 'event-1');

    expect(queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'incident-confidence.recalculate',
      { incidentId, reason: 'moderation-changed' },
      expect.objectContaining({
        jobId: `incident-confidence-${incidentId}-moderation-changed-event-1`,
      }),
    );
  });
});

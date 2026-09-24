import { ConflictException } from '@nestjs/common';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import { FloodReportsService } from './flood-reports.service';

const incident = {
  id: '10000000-0000-4000-8000-000000000010',
  incidentType: IncidentType.SEVERE_FLOODING,
  severity: IncidentSeverity.SEVERE,
  status: IncidentStatus.ACTIVE,
  location: { longitude: 3.4, latitude: 6.4, srid: 4326 as const },
  affectedGeometry: null,
  locationName: 'Test Road',
  description: 'Flood water is blocking the lane',
  confidence: { score: 0.35, label: 'LOW' as const },
  sourceType: 'COMMUNITY' as const,
  confirmationCount: 0,
  photoCount: 0,
  firstReportedAt: new Date(),
  lastConfirmedAt: null,
  resolvedAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const submission = {
  reporterUserId: '10000000-0000-4000-8000-000000000001',
  reportType: IncidentType.SEVERE_FLOODING,
  longitude: 3.4,
  latitude: 6.4,
  locationName: 'Test Road',
  description: 'Flood water is blocking the lane',
  observedSeverity: IncidentSeverity.SEVERE,
};

function createService() {
  const transaction = { $queryRaw: jest.fn() };
  const prisma = {
    $transaction: jest.fn((callback: (value: unknown) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'floodReport.duplicateWindowSeconds': 60,
        'floodReport.duplicateRadiusMeters': 50,
      };
      return values[key];
    }),
  };
  const repository = {
    acquireSubmissionLock: jest.fn(),
    findRecentDuplicate: jest.fn().mockResolvedValue(null),
    createWithinTransaction: jest.fn(),
  };
  const associationService = {
    associateOrCreate: jest.fn().mockResolvedValue(incident),
  };
  const queueService = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
  const logger = { error: jest.fn() };

  return {
    service: new FloodReportsService(
      prisma as never,
      configService as never,
      repository as never,
      associationService as never,
      queueService as never,
      logger as never,
    ),
    prisma,
    repository,
    associationService,
    queueService,
  };
}

describe('FloodReportsService', () => {
  it('creates a report, associates a new canonical incident, and emits a job', async () => {
    const harness = createService();

    const result = await harness.service.submit(submission);

    expect(result).toMatchObject({ reportId: expect.any(String), incident });
    expect(harness.associationService.associateOrCreate).toHaveBeenCalled();
    expect(harness.repository.createWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ incidentId: incident.id, reportType: submission.reportType }),
    );
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'flood-report.created',
      expect.objectContaining({
        incidentId: incident.id,
        reporterUserId: submission.reporterUserId,
      }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('returns an existing nearby incident association without changing confidence', async () => {
    const harness = createService();

    await harness.service.submit(submission);

    expect(harness.associationService.associateOrCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reportType: IncidentType.SEVERE_FLOODING }),
    );
    expect(harness.repository.createWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ incidentId: incident.id }),
    );
  });

  it('rejects invalid coordinates before opening a transaction', async () => {
    const harness = createService();

    await expect(harness.service.submit({ ...submission, longitude: 181 })).rejects.toThrow(
      'longitude must be between',
    );
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects rapid duplicate submissions and does not create a report', async () => {
    const harness = createService();
    harness.repository.findRecentDuplicate.mockResolvedValue(
      '10000000-0000-4000-8000-000000000011',
    );

    await expect(harness.service.submit(submission)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.repository.createWithinTransaction).not.toHaveBeenCalled();
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });

  it('propagates transaction failure and does not emit a post-commit job', async () => {
    const harness = createService();
    const failure = new Error('insert failed');
    harness.repository.createWithinTransaction.mockRejectedValue(failure);

    await expect(harness.service.submit(submission)).rejects.toBe(failure);
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });
});

import { ConflictException } from '@nestjs/common';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import { IncidentConfirmationsService } from './incident-confirmations.service';

const incidentId = '10000000-0000-4000-8000-000000000010';
const firstUserId = '10000000-0000-4000-8000-000000000001';
const secondUserId = '10000000-0000-4000-8000-000000000002';
const confirmationId = '10000000-0000-4000-8000-000000000011';

const now = new Date('2026-01-01T00:00:00.000Z');
const incident = {
  id: incidentId,
  incidentType: IncidentType.SEVERE_FLOODING,
  severity: IncidentSeverity.SEVERE,
  status: IncidentStatus.ACTIVE,
  confirmationCount: 1,
  lastConfirmedAt: now,
};

function createService() {
  const transaction = { $queryRaw: jest.fn() };
  const prisma = {
    $transaction: jest.fn((callback: (value: unknown) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const repository = {
    lockIncident: jest.fn().mockResolvedValue({
      id: incidentId,
      status: IncidentStatus.ACTIVE,
      expiresAt: null,
      databaseNow: now,
    }),
    findByIncidentAndUser: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockResolvedValue({ id: confirmationId, createdAt: now, lastConfirmedAt: null }),
    refresh: jest
      .fn()
      .mockResolvedValue({ id: confirmationId, createdAt: now, lastConfirmedAt: now }),
    recalculateIncidentAggregate: jest.fn().mockResolvedValue({
      confirmationCount: 1,
      lastConfirmedAt: now,
    }),
  };
  const incidentsService = {
    findByIdInTransaction: jest.fn().mockResolvedValue(incident),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(900),
  };
  const queueService = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
  const logger = { error: jest.fn() };

  return {
    service: new IncidentConfirmationsService(
      prisma as never,
      configService as never,
      repository as never,
      incidentsService as never,
      queueService as never,
      logger as never,
    ),
    prisma,
    repository,
    incidentsService,
    queueService,
  };
}

describe('IncidentConfirmationsService', () => {
  it('creates the first confirmation, recalculates aggregates, and emits an event job', async () => {
    const harness = createService();

    await expect(harness.service.confirm(incidentId, firstUserId)).resolves.toBe(incident);

    expect(harness.repository.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      incidentId,
      firstUserId,
      { source: 'COMMUNITY_API', method: 'MANUAL_CONFIRMATION' },
    );
    expect(harness.repository.recalculateIncidentAggregate).toHaveBeenCalledWith(
      expect.anything(),
      incidentId,
    );
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'incident-confirmation.created',
      expect.objectContaining({ incidentId, userId: firstUserId }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('treats a repeated request within the cooldown as idempotent', async () => {
    const harness = createService();
    harness.repository.findByIncidentAndUser.mockResolvedValue({
      id: confirmationId,
      createdAt: new Date(now.getTime() - 30_000),
      lastConfirmedAt: null,
    });

    await expect(harness.service.confirm(incidentId, firstUserId)).resolves.toBe(incident);

    expect(harness.repository.create).not.toHaveBeenCalled();
    expect(harness.repository.refresh).not.toHaveBeenCalled();
    expect(harness.repository.recalculateIncidentAggregate).not.toHaveBeenCalled();
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });

  it('allows a reconfirmation after cooldown without inflating the unique-user count', async () => {
    const harness = createService();
    harness.repository.findByIncidentAndUser.mockResolvedValue({
      id: confirmationId,
      createdAt: new Date('2025-12-31T23:00:00.000Z'),
      lastConfirmedAt: new Date('2025-12-31T23:00:00.000Z'),
    });

    await expect(harness.service.confirm(incidentId, firstUserId)).resolves.toBe(incident);

    expect(harness.repository.refresh).toHaveBeenCalledWith(
      expect.anything(),
      confirmationId,
      firstUserId,
      expect.any(Object),
    );
    expect(harness.repository.create).not.toHaveBeenCalled();
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalled();
  });

  it('allows a different user to confirm the same incident', async () => {
    const harness = createService();

    await expect(harness.service.confirm(incidentId, secondUserId)).resolves.toBe(incident);

    expect(harness.repository.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      incidentId,
      secondUserId,
      expect.any(Object),
    );
  });

  it('rejects resolved, expired, and time-expired active incidents', async () => {
    const harness = createService();
    harness.repository.lockIncident.mockResolvedValue({
      id: incidentId,
      status: IncidentStatus.RESOLVED,
      expiresAt: null,
      databaseNow: now,
    });
    await expect(harness.service.confirm(incidentId, firstUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    harness.repository.lockIncident.mockResolvedValue({
      id: incidentId,
      status: IncidentStatus.ACTIVE,
      expiresAt: new Date('2025-12-31T23:59:00.000Z'),
      databaseNow: now,
    });
    await expect(harness.service.confirm(incidentId, firstUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(harness.repository.create).not.toHaveBeenCalled();
  });

  it('rolls back the write path when aggregate recalculation fails', async () => {
    const harness = createService();
    const failure = new Error('aggregate update failed');
    harness.repository.recalculateIncidentAggregate.mockRejectedValue(failure);

    await expect(harness.service.confirm(incidentId, firstUserId)).rejects.toBe(failure);
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });
});

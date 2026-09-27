import { NotificationType } from '@prisma/client';
import { AlertEvaluationService, NotificationDeliveryService } from './alert-evaluation.service';

const incidentId = '10000000-0000-4000-8000-000000000001';

function target(overrides: Record<string, unknown> = {}) {
  return {
    userId: '10000000-0000-4000-8000-000000000002',
    savedPlaceId: '10000000-0000-4000-8000-000000000003',
    savedPlaceLabel: 'Home',
    distanceMeters: 3_500,
    enabledChannels: ['APP_PUSH'],
    sourceId: incidentId,
    sourceType: NotificationType.INCIDENT_ALERT,
    incidentType: 'SEVERE_FLOODING',
    severity: 'SEVERE',
    title: 'Flooding alert near Home',
    body: 'Water reported nearby',
    ...overrides,
  };
}

function createEvaluationHarness() {
  const queueService = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
  const repository = {
    findIncidentTargets: jest.fn(),
    findOfficialWarningTargets: jest.fn(),
  };
  const notificationRepository = { createIfAbsent: jest.fn() };
  const logger = { error: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'alertPreference.defaultRadiusMeters' ? 1_000 : 250,
    ),
  };
  return {
    service: new AlertEvaluationService(
      config as never,
      queueService as never,
      repository as never,
      notificationRepository as never,
      logger as never,
    ),
    queueService,
    repository,
    notificationRepository,
  };
}

describe('AlertEvaluationService', () => {
  it('evaluates only database-matched targets inside the configured radius', async () => {
    const harness = createEvaluationHarness();
    harness.repository.findIncidentTargets
      .mockResolvedValueOnce([target()])
      .mockResolvedValueOnce([]);
    harness.notificationRepository.createIfAbsent.mockResolvedValue({
      notification: { id: 'notification-id' },
      deliveryIds: ['delivery-id'],
    });

    await expect(harness.service.evaluateIncident(incidentId)).resolves.toBe(1);
    expect(harness.notificationRepository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ distanceMeters: 3_500 }),
      'SEVERE_FLOODING:3',
      3,
    );
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledTimes(1);
  });

  it('does not deliver duplicate equivalent evaluation results', async () => {
    const harness = createEvaluationHarness();
    harness.repository.findIncidentTargets
      .mockResolvedValueOnce([target()])
      .mockResolvedValueOnce([]);
    harness.notificationRepository.createIfAbsent.mockResolvedValue(null);

    await expect(harness.service.evaluateIncident(incidentId)).resolves.toBe(0);
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });

  it('preserves channel filtering and supports escalation keys', async () => {
    const harness = createEvaluationHarness();
    harness.repository.findIncidentTargets
      .mockResolvedValueOnce([
        target({ enabledChannels: ['SMS'], incidentType: 'SEVERE_FLOODING', severity: 'SEVERE' }),
      ])
      .mockResolvedValueOnce([]);
    harness.notificationRepository.createIfAbsent.mockResolvedValue({
      notification: { id: 'notification-id' },
      deliveryIds: ['sms-delivery-id'],
    });

    await harness.service.evaluateIncident(incidentId);
    expect(harness.notificationRepository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ enabledChannels: ['SMS'] }),
      'SEVERE_FLOODING:3',
      3,
    );
  });
});

describe('NotificationDeliveryService', () => {
  it('marks a transient provider failure and allows BullMQ to retry', async () => {
    const repository = {
      claimDelivery: jest.fn().mockResolvedValue({
        id: 'delivery-id',
        notificationId: 'notification-id',
        userId: '10000000-0000-4000-8000-000000000002',
        channel: 'APP_PUSH',
        status: 'DELIVERING',
        attemptCount: 1,
        providerMessageId: null,
        title: 'Alert',
        body: 'Flood nearby',
        incidentId,
        officialWarningId: null,
      }),
      findPushRecipients: jest
        .fn()
        .mockResolvedValue([
          { registrationId: 'device-id', token: 'opaque-token', platform: 'ANDROID' },
        ]),
      markFailed: jest.fn(),
      markSent: jest.fn(),
      markSkipped: jest.fn(),
    };
    const provider = { send: jest.fn().mockRejectedValue(new Error('temporary provider failure')) };
    const service = new NotificationDeliveryService(
      repository as never,
      provider,
      {} as never,
      {} as never,
    );

    await expect(service.deliver('delivery-id', 0, 5)).rejects.toThrow(
      'temporary provider failure',
    );
    expect(repository.markFailed).toHaveBeenCalledWith(
      'delivery-id',
      'temporary provider failure',
      false,
      expect.any(Date),
    );
  });
});

import { SystemJobsProcessor } from './system-jobs.processor';
import { INCIDENT_EXPIRATION_SWEEP_JOB } from './system-job.constants';
import { NOTIFICATION_DELIVERY_JOB } from '../notifications/notification.constants';
import { OFFICIAL_WARNING_CREATED_JOB } from '../official-warnings/official-warnings.constants';
import { NAVIGATION_EVALUATE_INCIDENT_JOB } from '../navigation/navigation.constants';

const incidentId = '10000000-0000-4000-8000-000000000001';

function job(name: string) {
  return {
    name,
    id: 'job-1',
    data: { payload: { incidentId } },
  } as never;
}

function payloadJob(name: string, payload: Record<string, string>) {
  return {
    name,
    id: 'job-2',
    attemptsMade: 0,
    opts: { attempts: 5 },
    data: { payload },
  } as never;
}

describe('SystemJobsProcessor', () => {
  it('recalculates confidence and refreshes lifecycle after a report event', async () => {
    const confidenceService = { recalculateIncident: jest.fn() };
    const lifecycleService = { onReportSubmitted: jest.fn() };
    const processor = new SystemJobsProcessor(
      confidenceService as never,
      lifecycleService as never,
      { expireDueWarnings: jest.fn() } as never,
      { warn: jest.fn() } as never,
    );

    await processor.process(job('flood-report.created'));

    expect(lifecycleService.onReportSubmitted).toHaveBeenCalledWith(incidentId);
    expect(confidenceService.recalculateIncident).toHaveBeenCalledWith(incidentId);
  });

  it('runs the idempotent expiration sweep job', async () => {
    const lifecycleService = { expireStaleIncidents: jest.fn() };
    const processor = new SystemJobsProcessor(
      { recalculateIncident: jest.fn() } as never,
      lifecycleService as never,
      { expireDueWarnings: jest.fn() } as never,
      { warn: jest.fn() } as never,
    );

    await processor.process({ name: INCIDENT_EXPIRATION_SWEEP_JOB } as never);

    expect(lifecycleService.expireStaleIncidents).toHaveBeenCalledTimes(1);
  });

  it('routes official-warning events to alert evaluation', async () => {
    const alertEvaluationService = { enqueueOfficialWarningEvaluation: jest.fn() };
    const processor = new SystemJobsProcessor(
      { recalculateIncident: jest.fn() } as never,
      { expireStaleIncidents: jest.fn() } as never,
      { expireDueWarnings: jest.fn() } as never,
      { warn: jest.fn() } as never,
      alertEvaluationService as never,
    );

    await processor.process(
      payloadJob(OFFICIAL_WARNING_CREATED_JOB, {
        warningId: '10000000-0000-4000-8000-000000000003',
      }),
    );

    expect(alertEvaluationService.enqueueOfficialWarningEvaluation).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000003',
      OFFICIAL_WARNING_CREATED_JOB,
      'job-2',
    );
  });

  it('routes delivery jobs to the channel delivery service', async () => {
    const notificationDeliveryService = { deliver: jest.fn() };
    const processor = new SystemJobsProcessor(
      { recalculateIncident: jest.fn() } as never,
      { expireStaleIncidents: jest.fn() } as never,
      { expireDueWarnings: jest.fn() } as never,
      { warn: jest.fn() } as never,
      undefined,
      notificationDeliveryService as never,
    );

    await processor.process(
      payloadJob(NOTIFICATION_DELIVERY_JOB, {
        deliveryId: '10000000-0000-4000-8000-000000000004',
      }),
    );

    expect(notificationDeliveryService.deliver).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000004',
      0,
      5,
    );
  });

  it('routes navigation incident jobs to asynchronous impact evaluation', async () => {
    const navigationService = { evaluateIncidentImpact: jest.fn() };
    const processor = new SystemJobsProcessor(
      { recalculateIncident: jest.fn() } as never,
      { expireStaleIncidents: jest.fn() } as never,
      { expireDueWarnings: jest.fn() } as never,
      { warn: jest.fn() } as never,
      undefined,
      undefined,
      navigationService as never,
    );

    await processor.process(payloadJob(NAVIGATION_EVALUATE_INCIDENT_JOB, { incidentId }));

    expect(navigationService.evaluateIncidentImpact).toHaveBeenCalledWith(incidentId);
  });
});

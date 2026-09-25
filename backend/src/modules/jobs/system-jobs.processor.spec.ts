import { SystemJobsProcessor } from './system-jobs.processor';
import { INCIDENT_EXPIRATION_SWEEP_JOB } from './system-job.constants';

const incidentId = '10000000-0000-4000-8000-000000000001';

function job(name: string) {
  return {
    name,
    id: 'job-1',
    data: { payload: { incidentId } },
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
});

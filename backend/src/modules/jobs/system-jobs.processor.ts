import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { FLOOD_REPORT_CREATED_JOB } from '../flood-reports/flood-reports.constants';
import { INCIDENT_CONFIDENCE_RECALCULATE_JOB } from '../incidents/incident-confidence.constants';
import { IncidentConfidenceService } from '../incidents/incident-confidence.service';
import { IncidentLifecycleService } from '../incidents/incident-lifecycle.service';
import { OfficialWarningsService } from '../official-warnings/official-warnings.service';
import { OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB } from '../official-warnings/official-warnings.constants';
import { INCIDENT_EXPIRATION_SWEEP_JOB } from './system-job.constants';
import { INCIDENT_CONFIRMATION_CREATED_JOB } from '../report-confirmations/incident-confirmations.constants';

interface JobEnvelopeLike {
  payload?: unknown;
}

@Injectable()
@Processor(QUEUE_NAMES.System)
export class SystemJobsProcessor extends WorkerHost {
  constructor(
    private readonly confidenceService: IncidentConfidenceService,
    private readonly lifecycleService: IncidentLifecycleService,
    private readonly officialWarningsService: OfficialWarningsService,
    private readonly logger: StructuredLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case FLOOD_REPORT_CREATED_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.lifecycleService.onReportSubmitted(incidentId);
        await this.confidenceService.recalculateIncident(incidentId);
        return;
      }
      case INCIDENT_CONFIRMATION_CREATED_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.lifecycleService.onIncidentConfirmed(incidentId);
        await this.confidenceService.recalculateIncident(incidentId);
        return;
      }
      case INCIDENT_CONFIDENCE_RECALCULATE_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.confidenceService.recalculateIncident(incidentId);
        return;
      }
      case INCIDENT_EXPIRATION_SWEEP_JOB:
        await this.lifecycleService.expireStaleIncidents();
        return;
      case OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB:
        await this.officialWarningsService.expireDueWarnings();
        return;
      default:
        this.logger.warn({ jobName: job.name, jobId: job.id }, 'SystemJobsProcessor.unknownJob');
    }
  }

  private getIncidentId(data: unknown): string {
    const envelope = data as JobEnvelopeLike | null;
    const payload = envelope?.payload as { incidentId?: unknown } | undefined;
    if (
      !payload ||
      typeof payload.incidentId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.incidentId,
      )
    ) {
      throw new Error('System job payload must contain a valid incidentId');
    }
    return payload.incidentId;
  }
}

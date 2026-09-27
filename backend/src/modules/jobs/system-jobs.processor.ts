import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { FLOOD_REPORT_CREATED_JOB } from '../flood-reports/flood-reports.constants';
import { INCIDENT_CONFIDENCE_RECALCULATE_JOB } from '../incidents/incident-confidence.constants';
import { IncidentConfidenceService } from '../incidents/incident-confidence.service';
import { IncidentLifecycleService } from '../incidents/incident-lifecycle.service';
import { OfficialWarningsService } from '../official-warnings/official-warnings.service';
import { OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB } from '../official-warnings/official-warnings.constants';
import { INCIDENT_EXPIRATION_SWEEP_JOB } from './system-job.constants';
import { INCIDENT_CONFIRMATION_CREATED_JOB } from '../report-confirmations/incident-confirmations.constants';
import {
  ALERT_EVALUATE_INCIDENT_JOB,
  ALERT_EVALUATE_OFFICIAL_WARNING_JOB,
  NOTIFICATION_DELIVERY_JOB,
} from '../notifications/notification.constants';
import {
  AlertEvaluationService,
  NotificationDeliveryService,
} from '../notifications/alert-evaluation.service';
import {
  OFFICIAL_WARNING_CANCELLED_JOB,
  OFFICIAL_WARNING_CHANGED_JOB,
  OFFICIAL_WARNING_CREATED_JOB,
  OFFICIAL_WARNING_EXPIRED_JOB,
} from '../official-warnings/official-warnings.constants';
import { NavigationService } from '../navigation/navigation.service';
import {
  NAVIGATION_EVALUATE_INCIDENT_JOB,
  NAVIGATION_ROUTE_UPDATE_DELIVERY_JOB,
  NAVIGATION_SESSION_EXPIRATION_SWEEP_JOB,
} from '../navigation/navigation.constants';

interface JobEnvelopeLike {
  payload?: unknown;
  correlationId?: unknown;
}

@Injectable()
@Processor(QUEUE_NAMES.System)
export class SystemJobsProcessor extends WorkerHost {
  constructor(
    private readonly confidenceService: IncidentConfidenceService,
    private readonly lifecycleService: IncidentLifecycleService,
    private readonly officialWarningsService: OfficialWarningsService,
    private readonly logger: StructuredLogger,
    @Optional() private readonly alertEvaluationService?: AlertEvaluationService,
    @Optional() private readonly notificationDeliveryService?: NotificationDeliveryService,
    @Optional() private readonly navigationService?: NavigationService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const jobName = String(job.name);
    const correlationId = this.getCorrelationId(job.data);
    this.metrics?.increment('queue_jobs_started_total', { job: jobName });
    this.logger.debug?.({ job: jobName, correlationId }, 'SystemJobsProcessor.started');
    try {
      await this.processJob(job, correlationId);
      this.metrics?.increment('queue_jobs_completed_total', { job: jobName });
      this.logger.debug?.({ job: jobName, correlationId }, 'SystemJobsProcessor.completed');
    } catch (error) {
      this.metrics?.increment('queue_jobs_failed_total', { job: jobName });
      this.logger.error(
        { job: jobName, correlationId },
        error instanceof Error ? error.stack : undefined,
        'SystemJobsProcessor.failure',
      );
      throw error;
    }
  }

  private async processJob(job: Job, correlationId: string): Promise<void> {
    switch (job.name) {
      case FLOOD_REPORT_CREATED_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.lifecycleService.onReportSubmitted(incidentId);
        await this.confidenceService.recalculateIncident(incidentId);
        await this.enqueueIncidentAlertEvaluation(job, incidentId, 'report-created', correlationId);
        await this.enqueueNavigationEvaluation(job, incidentId, 'report-created', correlationId);
        return;
      }
      case INCIDENT_CONFIRMATION_CREATED_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.lifecycleService.onIncidentConfirmed(incidentId);
        await this.confidenceService.recalculateIncident(incidentId);
        await this.enqueueIncidentAlertEvaluation(
          job,
          incidentId,
          'incident-confirmed',
          correlationId,
        );
        await this.enqueueNavigationEvaluation(
          job,
          incidentId,
          'incident-confirmed',
          correlationId,
        );
        return;
      }
      case INCIDENT_CONFIDENCE_RECALCULATE_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.confidenceService.recalculateIncident(incidentId);
        await this.enqueueIncidentAlertEvaluation(
          job,
          incidentId,
          'confidence-recalculated',
          correlationId,
        );
        await this.enqueueNavigationEvaluation(
          job,
          incidentId,
          'confidence-recalculated',
          correlationId,
        );
        return;
      }
      case INCIDENT_EXPIRATION_SWEEP_JOB:
        await this.lifecycleService.expireStaleIncidents();
        return;
      case OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB:
        await this.officialWarningsService.expireDueWarnings();
        return;
      case OFFICIAL_WARNING_CREATED_JOB:
      case OFFICIAL_WARNING_CHANGED_JOB:
      case OFFICIAL_WARNING_EXPIRED_JOB:
      case OFFICIAL_WARNING_CANCELLED_JOB: {
        const warningId = this.getWarningId(job.data);
        await this.alertEvaluationService?.enqueueOfficialWarningEvaluation(
          warningId,
          job.name,
          String(job.id ?? warningId),
        );
        return;
      }
      case ALERT_EVALUATE_INCIDENT_JOB: {
        const sourceId = this.getSourceId(job.data);
        await this.alertEvaluationService?.evaluateIncident(sourceId);
        return;
      }
      case ALERT_EVALUATE_OFFICIAL_WARNING_JOB: {
        const sourceId = this.getSourceId(job.data);
        await this.alertEvaluationService?.evaluateOfficialWarning(sourceId);
        return;
      }
      case NOTIFICATION_DELIVERY_JOB: {
        const deliveryId = this.getDeliveryId(job.data);
        await this.notificationDeliveryService?.deliver(
          deliveryId,
          job.attemptsMade,
          Number(job.opts.attempts ?? 1),
        );
        return;
      }
      case NAVIGATION_EVALUATE_INCIDENT_JOB: {
        const incidentId = this.getIncidentId(job.data);
        await this.navigationService?.evaluateIncidentImpact(incidentId);
        return;
      }
      case NAVIGATION_ROUTE_UPDATE_DELIVERY_JOB: {
        const updateId = this.getUpdateId(job.data);
        await this.navigationService?.deliverRouteUpdate(updateId);
        return;
      }
      case NAVIGATION_SESSION_EXPIRATION_SWEEP_JOB:
        await this.navigationService?.expireStaleSessions();
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

  private getCorrelationId(data: unknown): string {
    const correlationId = (data as JobEnvelopeLike | null)?.correlationId;
    return typeof correlationId === 'string' && correlationId.length <= 128
      ? correlationId
      : 'unknown';
  }

  private getWarningId(data: unknown): string {
    const envelope = data as JobEnvelopeLike | null;
    const payload = envelope?.payload as { warningId?: unknown } | undefined;
    return this.assertUuid(payload?.warningId, 'warningId');
  }

  private getSourceId(data: unknown): string {
    const envelope = data as JobEnvelopeLike | null;
    const payload = envelope?.payload as { sourceId?: unknown } | undefined;
    return this.assertUuid(payload?.sourceId, 'sourceId');
  }

  private getDeliveryId(data: unknown): string {
    const envelope = data as JobEnvelopeLike | null;
    const payload = envelope?.payload as { deliveryId?: unknown } | undefined;
    return this.assertUuid(payload?.deliveryId, 'deliveryId');
  }

  private getUpdateId(data: unknown): string {
    const envelope = data as JobEnvelopeLike | null;
    const payload = envelope?.payload as { updateId?: unknown } | undefined;
    return this.assertUuid(payload?.updateId, 'updateId');
  }

  private assertUuid(value: unknown, field: string): string {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
      throw new Error(`System job payload must contain a valid ${field}`);
    }
    return value;
  }

  private async enqueueIncidentAlertEvaluation(
    job: Job,
    incidentId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    await this.alertEvaluationService?.enqueueIncidentEvaluation(
      incidentId,
      reason,
      `${String(job.id ?? `${reason}-${incidentId}`)}:${correlationId}`,
    );
  }

  private async enqueueNavigationEvaluation(
    job: Job,
    incidentId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    await this.navigationService?.enqueueIncidentEvaluation(
      incidentId,
      `${reason}-${String(job.id ?? incidentId)}:${correlationId}`,
    );
  }
}

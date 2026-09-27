import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  ALERT_EVALUATE_INCIDENT_JOB,
  ALERT_EVALUATE_OFFICIAL_WARNING_JOB,
  NOTIFICATION_DELIVERY_JOB,
} from './notification.constants';
import { AlertEvaluationRepository } from './alert-evaluation.repository';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import type { AlertTarget } from './notification.types';
import {
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
  WHATSAPP_NOTIFICATION_PROVIDER,
} from './notification-providers';
import type {
  PushNotificationProvider,
  SmsNotificationProvider,
  WhatsAppNotificationProvider,
} from './notification-providers';

export interface AlertEvaluationJobPayload {
  sourceId: string;
  eventId: string;
  reason: string;
}

export interface NotificationDeliveryJobPayload {
  deliveryId: string;
}

@Injectable()
export class AlertEvaluationService {
  private readonly defaultRadiusMeters: number;
  private readonly batchSize: number;

  constructor(
    configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly repository: AlertEvaluationRepository,
    private readonly notificationRepository: NotificationDeliveryRepository,
    private readonly logger: StructuredLogger,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.defaultRadiusMeters = configService.getOrThrow<number>(
      'alertPreference.defaultRadiusMeters',
    );
    this.batchSize = configService.getOrThrow<number>('notification.evaluationBatchSize');
  }

  async enqueueIncidentEvaluation(
    incidentId: string,
    reason: string,
    eventId: string,
  ): Promise<void> {
    await this.enqueue(
      ALERT_EVALUATE_INCIDENT_JOB,
      incidentId,
      reason,
      eventId,
      `alert-evaluation-incident-${incidentId}-${eventId}`,
    );
  }

  async enqueueOfficialWarningEvaluation(
    warningId: string,
    reason: string,
    eventId: string,
  ): Promise<void> {
    await this.enqueue(
      ALERT_EVALUATE_OFFICIAL_WARNING_JOB,
      warningId,
      reason,
      eventId,
      `alert-evaluation-warning-${warningId}-${eventId}`,
    );
  }

  async evaluateIncident(incidentId: string): Promise<number> {
    return this.evaluateSource(incidentId, NotificationType.INCIDENT_ALERT);
  }

  async evaluateOfficialWarning(warningId: string): Promise<number> {
    return this.evaluateSource(warningId, NotificationType.OFFICIAL_WARNING);
  }

  private async evaluateSource(sourceId: string, sourceType: NotificationType): Promise<number> {
    let afterUserId: string | undefined;
    let evaluated = 0;
    while (true) {
      const targets =
        sourceType === NotificationType.INCIDENT_ALERT
          ? await this.repository.findIncidentTargets(
              sourceId,
              this.defaultRadiusMeters,
              this.batchSize,
              afterUserId,
            )
          : await this.repository.findOfficialWarningTargets(
              sourceId,
              this.defaultRadiusMeters,
              this.batchSize,
              afterUserId,
            );
      if (targets.length === 0) break;
      for (const target of targets) {
        const created = await this.createNotification(target);
        if (created) evaluated += 1;
      }
      afterUserId = targets[targets.length - 1]?.userId;
      if (targets.length < this.batchSize || !afterUserId) break;
    }
    this.metrics?.increment('alert_evaluation_runs_total', { source_type: sourceType });
    this.metrics?.increment(
      'alert_evaluated_targets_total',
      { source_type: sourceType },
      evaluated,
    );
    return evaluated;
  }

  private async createNotification(target: AlertTarget): Promise<boolean> {
    const escalationLevel = this.severityRank(target.severity);
    const triggerKey = `${target.incidentType}:${escalationLevel}`;
    const created = await this.notificationRepository.createIfAbsent(
      target,
      triggerKey,
      escalationLevel,
    );
    if (!created) {
      this.metrics?.increment('alerts_deduplicated_total', { source_type: target.sourceType });
      return false;
    }
    this.metrics?.increment('alerts_created_total', { source_type: target.sourceType });
    for (const deliveryId of created.deliveryIds) {
      try {
        await this.queueService.enqueueSystemJob<NotificationDeliveryJobPayload>(
          NOTIFICATION_DELIVERY_JOB,
          { deliveryId },
          {
            jobId: `notification-delivery-${deliveryId}`,
            attempts: 5,
            backoffMs: 5_000,
          },
        );
      } catch (error) {
        this.logger.error(
          error,
          error instanceof Error ? error.stack : undefined,
          'AlertEvaluationService.enqueueDelivery',
        );
      }
    }
    return true;
  }

  private async enqueue(
    jobName: string,
    sourceId: string,
    reason: string,
    eventId: string,
    jobId: string,
  ): Promise<void> {
    await this.queueService.enqueueSystemJob<AlertEvaluationJobPayload>(
      jobName,
      { sourceId, reason, eventId },
      { jobId, attempts: 3, backoffMs: 1_000 },
    );
  }

  private severityRank(severity: string): number {
    return { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 }[severity] ?? 0;
  }
}

@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: PushNotificationProvider,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: SmsNotificationProvider,
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly whatsappProvider: WhatsAppNotificationProvider,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async deliver(deliveryId: string, attemptsMade: number, maxAttempts: number): Promise<void> {
    const delivery = await this.repository.claimDelivery(deliveryId);
    if (!delivery) return;
    const startedAt = Date.now();
    try {
      const message = {
        notificationId: delivery.notificationId,
        title: delivery.title,
        body: delivery.body,
      };
      let providerMessageId: string | undefined;
      if (delivery.channel === 'APP_PUSH') {
        const recipients = await this.repository.findPushRecipients(delivery.userId);
        if (recipients.length === 0) {
          await this.repository.markSkipped(delivery.id, 'No active push devices remain');
          this.metrics?.increment('notification_deliveries_total', {
            channel: delivery.channel,
            result: 'skipped',
          });
          return;
        }
        providerMessageId = (await this.pushProvider.send(message, recipients)).providerMessageId;
      } else {
        const route = await this.repository.findMessagingRoute(delivery.userId, delivery.channel);
        if (!route) {
          await this.repository.markSkipped(
            delivery.id,
            'Verified messaging destination is unavailable',
          );
          this.metrics?.increment('notification_deliveries_total', {
            channel: delivery.channel,
            result: 'skipped',
          });
          return;
        }
        providerMessageId =
          delivery.channel === 'SMS'
            ? (await this.smsProvider.send(message, route.phoneNumber)).providerMessageId
            : (await this.whatsappProvider.send(message, route.phoneNumber)).providerMessageId;
      }
      await this.repository.markSent(delivery.id, providerMessageId);
      this.metrics?.increment('notification_deliveries_total', {
        channel: delivery.channel,
        result: 'sent',
      });
      this.metrics?.observe('notification_provider_latency_ms', Date.now() - startedAt, {
        channel: delivery.channel,
      });
    } catch (error) {
      const deadLetter = attemptsMade + 1 >= maxAttempts;
      await this.repository.markFailed(
        delivery.id,
        error instanceof Error ? error.message : 'Notification provider failed',
        deadLetter,
        new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** attemptsMade)),
      );
      this.metrics?.increment('notification_deliveries_total', {
        channel: delivery.channel,
        result: deadLetter ? 'dead_letter' : 'failed',
      });
      this.metrics?.observe('notification_provider_latency_ms', Date.now() - startedAt, {
        channel: delivery.channel,
      });
      throw error;
    }
  }
}

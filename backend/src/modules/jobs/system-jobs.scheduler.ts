import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB } from '../official-warnings/official-warnings.constants';
import { INCIDENT_EXPIRATION_SWEEP_JOB } from './system-job.constants';

@Injectable()
export class SystemJobsScheduler implements OnModuleInit {
  private readonly expirationSweepIntervalMs: number;

  constructor(
    configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly logger: StructuredLogger,
  ) {
    this.expirationSweepIntervalMs = configService.getOrThrow<number>(
      'incidentLifecycle.expirationSweepIntervalMs',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queueService.enqueueSystemJob(
        INCIDENT_EXPIRATION_SWEEP_JOB,
        {},
        {
          jobId: 'incident-expiration-sweep',
          repeatEveryMs: this.expirationSweepIntervalMs,
          attempts: 3,
          backoffMs: 1_000,
        },
      );
      await this.queueService.enqueueSystemJob(
        OFFICIAL_WARNING_EXPIRATION_SWEEP_JOB,
        {},
        {
          jobId: 'official-warning-expiration-sweep',
          repeatEveryMs: this.expirationSweepIntervalMs,
          attempts: 3,
          backoffMs: 1_000,
        },
      );
    } catch (error) {
      // Redis readiness is reported separately. A transient queue outage at
      // boot must remain observable without hiding the HTTP process startup.
      this.logger.error(
        error,
        error instanceof Error ? error.stack : undefined,
        'SystemJobsScheduler.scheduleExpirationSweep',
      );
    }
  }
}

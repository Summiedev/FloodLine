import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, JobsOptions, Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { EnqueueOptions, JobEnvelope } from '../../common/queue/job.types';
import { MetricsService } from '../../common/metrics/metrics.service';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.System) private readonly systemQueue: Queue,
    private readonly metrics: MetricsService,
  ) {}

  async enqueueSystemJob<TPayload>(
    jobName: string,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<Job<JobEnvelope<TPayload>>> {
    const envelope: JobEnvelope<TPayload> = {
      jobId: options.jobId ?? randomUUID(),
      correlationId: options.correlationId ?? randomUUID(),
      enqueuedAt: new Date().toISOString(),
      payload,
    };
    const jobOptions: JobsOptions = {
      jobId: envelope.jobId,
      ...(options.delayMs !== undefined ? { delay: options.delayMs } : {}),
      ...(options.attempts !== undefined ? { attempts: options.attempts } : {}),
      ...(options.backoffMs !== undefined
        ? { backoff: { type: 'exponential', delay: options.backoffMs } }
        : {}),
      ...(options.repeatEveryMs !== undefined ? { repeat: { every: options.repeatEveryMs } } : {}),
    };

    const job = (await this.systemQueue.add(jobName, envelope, jobOptions)) as Job<
      JobEnvelope<TPayload>
    >;
    this.metrics.increment('queue_jobs_enqueued_total', { job: jobName });
    return job;
  }

  async getSystemQueueDepth(): Promise<Record<string, number>> {
    const counts = await this.systemQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, JobsOptions, Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { EnqueueOptions, JobEnvelope } from '../../common/queue/job.types';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueService {
  constructor(@InjectQueue(QUEUE_NAMES.System) private readonly systemQueue: Queue) {}

  async enqueueSystemJob<TPayload>(
    jobName: string,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<Job<JobEnvelope<TPayload>>> {
    const envelope: JobEnvelope<TPayload> = {
      jobId: options.jobId ?? randomUUID(),
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
    };

    return (await this.systemQueue.add(jobName, envelope, jobOptions)) as Job<
      JobEnvelope<TPayload>
    >;
  }
}

export interface JobEnvelope<TPayload> {
  jobId: string;
  correlationId: string;
  enqueuedAt: string;
  payload: TPayload;
}

export interface JobHandler<TPayload, TResult = void> {
  handle(payload: TPayload): Promise<TResult>;
}

export interface EnqueueOptions {
  jobId?: string;
  correlationId?: string;
  delayMs?: number;
  attempts?: number;
  backoffMs?: number;
  repeatEveryMs?: number;
}

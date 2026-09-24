export interface JobEnvelope<TPayload> {
  jobId: string;
  enqueuedAt: string;
  payload: TPayload;
}

export interface JobHandler<TPayload, TResult = void> {
  handle(payload: TPayload): Promise<TResult>;
}

export interface EnqueueOptions {
  jobId?: string;
  delayMs?: number;
  attempts?: number;
  backoffMs?: number;
}

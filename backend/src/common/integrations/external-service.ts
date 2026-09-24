export interface ExternalService {
  readonly name: string;
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
  maxBackoffMs?: number;
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    readonly serviceName: string,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ExternalServiceError';
  }
}

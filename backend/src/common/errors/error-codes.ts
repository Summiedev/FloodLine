export const ErrorCodes = {
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  ValidationError: 'VALIDATION_ERROR',
  NotFound: 'NOT_FOUND',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  DependencyUnavailable: 'DEPENDENCY_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

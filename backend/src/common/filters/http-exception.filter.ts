import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApplicationError } from '../errors/application.error';
import { ErrorCodes } from '../errors/error-codes';
import { StructuredLogger } from '../logging/structured-logger.service';
import { RequestWithId } from '../request-context/request-id.middleware';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    timestamp: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId;
    const normalized = this.normalizeException(exception);

    if (normalized.status >= 500) {
      this.logger.error(
        exception,
        exception instanceof Error ? exception.stack : undefined,
        'HttpExceptionFilter',
      );
    }

    const body: ErrorResponseBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(requestId ? { requestId } : {}),
        ...(normalized.details !== undefined ? { details: normalized.details } : {}),
        timestamp: new Date().toISOString(),
      },
    };

    response.status(normalized.status).json(body);
  }

  private normalizeException(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof ApplicationError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        return { status, code: this.codeForStatus(status), message: exceptionResponse };
      }

      const responseBody = exceptionResponse as Record<string, unknown>;
      const message = Array.isArray(responseBody.message)
        ? 'Request validation failed'
        : typeof responseBody.message === 'string'
          ? responseBody.message
          : exception.message;

      return {
        status,
        code: status === 400 ? ErrorCodes.ValidationError : this.codeForStatus(status),
        message,
        ...(Array.isArray(responseBody.message) ? { details: responseBody.message } : {}),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCodes.InternalServerError,
      message: 'Internal server error',
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 401:
        return ErrorCodes.Unauthorized;
      case 403:
        return ErrorCodes.Forbidden;
      case 404:
        return ErrorCodes.NotFound;
      case 409:
        return ErrorCodes.Conflict;
      case 429:
        return ErrorCodes.RateLimited;
      default:
        return status >= 500 ? ErrorCodes.InternalServerError : `HTTP_${status}`;
    }
  }
}

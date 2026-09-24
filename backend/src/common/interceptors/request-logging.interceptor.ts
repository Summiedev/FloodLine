import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { StructuredLogger } from '../logging/structured-logger.service';
import { RequestWithId } from '../request-context/request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(request, response, startedAt),
        error: (error: unknown) =>
          this.logRequest(
            request,
            response,
            startedAt,
            error instanceof HttpException ? error.getStatus() : 500,
          ),
      }),
    );
  }

  private logRequest(
    request: Request,
    response: Response,
    startedAt: number,
    errorStatus?: number,
  ): void {
    this.logger.log(
      {
        requestId: (request as RequestWithId).requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: errorStatus ?? response.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'HTTP',
    );
  }
}

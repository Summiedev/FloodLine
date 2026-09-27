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
import { MetricsService } from '../metrics/metrics.service';
import { RequestWithId } from '../request-context/request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly metrics: MetricsService,
  ) {}

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
    const statusCode = errorStatus ?? response.statusCode;
    const durationMs = Date.now() - startedAt;
    const requestShape = request as unknown as {
      route?: { path?: unknown };
      path?: unknown;
    };
    const routePath =
      typeof requestShape.route?.path === 'string'
        ? requestShape.route.path
        : typeof requestShape.path === 'string'
          ? requestShape.path
          : '[unknown]';
    this.metrics.increment('http_requests_total', {
      method: request.method,
      status_class: `${Math.floor(statusCode / 100)}xx`,
    });
    this.metrics.observe('http_request_duration_ms', durationMs, { method: request.method });
    this.logger.log(
      {
        requestId: (request as RequestWithId).requestId,
        method: request.method,
        path: routePath,
        statusCode,
        durationMs,
      },
      'HTTP',
    );
  }
}

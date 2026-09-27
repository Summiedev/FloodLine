import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { MetricsService } from './metrics.service';

@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async get(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (!this.config.get<boolean>('metrics.enabled')) throw new NotFoundException();
    const configuredToken = this.config.get<string>('metrics.accessToken');
    const environment = this.config.get<string>('app.environment');
    if (environment === 'production' && !configuredToken) throw new ForbiddenException();
    if (configuredToken && !safeEqual(request.get('x-metrics-token') ?? '', configuredToken)) {
      throw new ForbiddenException();
    }

    try {
      const depth = await this.queue.getSystemQueueDepth();
      for (const [name, value] of Object.entries(depth)) {
        this.metrics.setGauge(`queue_system_${name}`, value);
      }
    } catch {
      this.metrics.setGauge('queue_system_unavailable', 1);
    }
    response.type('text/plain; version=0.0.4').send(this.metrics.prometheusText());
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

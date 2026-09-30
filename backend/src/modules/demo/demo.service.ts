import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { NAVIGATION_EVALUATE_INCIDENT_JOB } from '../navigation/navigation.constants';
import { ALERT_EVALUATE_INCIDENT_JOB } from '../notifications/notification.constants';
import { DEMO_DESTINATION, DEMO_HAZARD_ID, DEMO_ORIGIN } from './demo.constants';

@Injectable()
export class DemoService {
  private readonly enabled: boolean;
  private readonly routingProvider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly logger: StructuredLogger,
    configService: ConfigService,
  ) {
    this.enabled = configService.get<boolean>('demo.enabled') ?? false;
    this.routingProvider = configService.get<string>('routing.provider') ?? 'local';
  }

  async triggerHazard(actorUserId: string): Promise<{
    activated: true;
    incidentId: string;
    message: string;
  }> {
    if (!this.enabled) {
      throw new ApplicationError(
        ErrorCodes.NotFound,
        'Demo controls are not enabled',
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60_000);
    const updated = await this.prisma.$executeRaw`
      UPDATE "incidents"
      SET "status" = CAST('ACTIVE' AS "IncidentStatus"),
          "resolved_at" = NULL,
          "expires_at" = ${expiresAt},
          "updated_at" = ${now}
      WHERE "id" = ${DEMO_HAZARD_ID}::uuid
    `;

    if (updated === 0) {
      throw new ApplicationError(
        ErrorCodes.NotFound,
        'Demo hazard is missing. Run the demo seed first.',
      );
    }

    await this.clearRouteCache();
    const eventId = randomUUID();
    const baseOptions = {
      correlationId: `demo-${eventId}`,
      attempts: 3,
      backoffMs: 1_000,
    };
    await this.queue.enqueueSystemJob(
      NAVIGATION_EVALUATE_INCIDENT_JOB,
      { incidentId: DEMO_HAZARD_ID },
      { ...baseOptions, jobId: `${NAVIGATION_EVALUATE_INCIDENT_JOB}-${DEMO_HAZARD_ID}-${eventId}` },
    );
    await this.queue.enqueueSystemJob(
      ALERT_EVALUATE_INCIDENT_JOB,
      { incidentId: DEMO_HAZARD_ID },
      { ...baseOptions, jobId: `${ALERT_EVALUATE_INCIDENT_JOB}-${DEMO_HAZARD_ID}-${eventId}` },
    );

    this.logger.log(
      { actorUserId, incidentId: DEMO_HAZARD_ID, eventId },
      'DemoService.triggerHazard',
    );
    return {
      activated: true,
      incidentId: DEMO_HAZARD_ID,
      message: 'Controlled demo hazard activated. FloodLine is checking routes.',
    };
  }

  private async clearRouteCache(): Promise<void> {
    const normalized = JSON.stringify({
      provider: this.routingProvider,
      origin: { longitude: Number(DEMO_ORIGIN.longitude.toFixed(5)), latitude: Number(DEMO_ORIGIN.latitude.toFixed(5)) },
      destination: { longitude: Number(DEMO_DESTINATION.longitude.toFixed(5)), latitude: Number(DEMO_DESTINATION.latitude.toFixed(5)) },
      waypoints: [],
      travelMode: 'DRIVING',
    });
    const key = `routing:preview:v2:${createHash('sha256').update(normalized).digest('hex')}`;
    await this.redis.getClient().del(key);
  }
}

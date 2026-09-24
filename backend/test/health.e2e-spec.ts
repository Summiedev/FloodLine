import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            liveness: () => ({
              status: 'ok',
              service: 'floodline-api',
              timestamp: new Date().toISOString(),
            }),
            readiness: () =>
              Promise.resolve({
                status: 'ready' as const,
                checks: { database: { status: 'up' as const }, redis: { status: 'up' as const } },
                timestamp: new Date().toISOString(),
              }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves the versioned liveness endpoint', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }: { body: { status: string } }) => {
        expect(body.status).toBe('ok');
      });
  });

  it('serves the versioned readiness endpoint', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer).get('/api/v1/health/ready').expect(200);
  });
});

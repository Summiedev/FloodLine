import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { IncidentConfirmationsController } from '../src/modules/report-confirmations/incident-confirmations.controller';
import { IncidentConfirmationsService } from '../src/modules/report-confirmations/incident-confirmations.service';

describe('Incident confirmation HTTP surface (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const principal = {
      userId: '10000000-0000-4000-8000-000000000001',
      sessionId: '10000000-0000-4000-8000-000000000002',
      id: '10000000-0000-4000-8000-000000000001',
      email: 'person@example.com',
      phoneNumber: null,
      displayName: 'Person',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [IncidentConfirmationsController],
      providers: [
        {
          provide: AuthService,
          useValue: { validateAccessToken: jest.fn().mockResolvedValue(principal) },
        },
        {
          provide: IncidentConfirmationsService,
          useValue: {
            confirm: jest.fn().mockResolvedValue({ id: 'incident-1', confirmationCount: 1 }),
          },
        },
        AccessTokenGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .post('/api/v1/incidents/10000000-0000-4000-8000-000000000010/confirm')
      .expect(401);
  });

  it('routes an authenticated confirmation to the service', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .post('/api/v1/incidents/10000000-0000-4000-8000-000000000010/confirm')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect(({ body }: { body: { id: string; confirmationCount: number } }) => {
        expect(body.id).toBe('incident-1');
        expect(body.confirmationCount).toBe(1);
      });
  });
});

import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { AlertPreferencesController } from '../src/modules/alert-preferences/alert-preferences.controller';
import { AlertPreferencesService } from '../src/modules/alert-preferences/alert-preferences.service';

describe('Alert preferences HTTP surface (e2e)', () => {
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
      controllers: [AlertPreferencesController],
      providers: [
        {
          provide: AuthService,
          useValue: { validateAccessToken: jest.fn().mockResolvedValue(principal) },
        },
        {
          provide: AlertPreferencesService,
          useValue: {
            getDefault: jest.fn().mockResolvedValue({
              radiusMeters: 3_500,
              incidentTypes: ['SEVERE_FLOODING'],
            }),
            updateDefault: jest.fn().mockResolvedValue({
              radiusMeters: 3_500,
              incidentTypes: ['SEVERE_FLOODING'],
            }),
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
    await request(httpServer).get('/api/v1/alert-preferences').expect(401);
  });

  it('gets and updates preferences for the authenticated user', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .patch('/api/v1/alert-preferences')
      .set('Authorization', 'Bearer test-token')
      .send({ radiusMeters: 3_500, incidentTypes: ['MODERATE_FLOODING'] })
      .expect(200)
      .expect(({ body }: { body: { radiusMeters: number; incidentTypes: string[] } }) => {
        expect(body.radiusMeters).toBe(3_500);
        expect(body.incidentTypes).toContain('SEVERE_FLOODING');
      });
  });
});

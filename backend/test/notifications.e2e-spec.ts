import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  DeviceRegistrationsController,
  NotificationPreferencesController,
  PhoneVerificationController,
} from '../src/modules/notifications/notifications.controller';
import { NotificationDestinationsService } from '../src/modules/notifications/notification-destinations.service';
import { NotificationPreferencesService } from '../src/modules/notifications/notification-preferences.service';

describe('Notification destinations HTTP surface (e2e)', () => {
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
      controllers: [
        NotificationPreferencesController,
        DeviceRegistrationsController,
        PhoneVerificationController,
      ],
      providers: [
        {
          provide: AuthService,
          useValue: { validateAccessToken: jest.fn().mockResolvedValue(principal) },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            get: jest.fn().mockResolvedValue({ channels: [] }),
            update: jest.fn().mockResolvedValue({ channels: [] }),
          },
        },
        {
          provide: NotificationDestinationsService,
          useValue: {
            registerDevice: jest.fn().mockResolvedValue({
              id: '20000000-0000-4000-8000-000000000001',
              platform: 'ANDROID',
              appVersion: null,
              lastSeenAt: new Date(),
              createdAt: new Date(),
            }),
            revokeDevice: jest.fn(),
            startVerification: jest.fn().mockResolvedValue({
              destination: '+234******678',
              purpose: 'PHONE',
              expiresAt: new Date(),
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
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => app.close());

  it('requires authentication for notification preferences', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer).get('/api/v1/notification-preferences').expect(401);
  });

  it('registers a device without returning its opaque token', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .post('/api/v1/devices')
      .set('Authorization', 'Bearer test-token')
      .send({ token: 'opaque-push-token-123456', platform: 'ANDROID' })
      .expect(201)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body.id).toBeDefined();
        expect(body).not.toHaveProperty('token');
      });
  });

  it('returns a masked phone destination when verification starts', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .post('/api/v1/phone/verification/start')
      .set('Authorization', 'Bearer test-token')
      .send({ phoneNumber: '+2348012345678' })
      .expect(201)
      .expect(({ body }: { body: { destination: string } }) => {
        expect(body.destination).toBe('+234******678');
        expect(body).not.toHaveProperty('code');
      });
  });
});

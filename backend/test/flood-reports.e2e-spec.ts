import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { FloodReportsController } from '../src/modules/flood-reports/flood-reports.controller';
import { FloodReportsService } from '../src/modules/flood-reports/flood-reports.service';

describe('Flood report HTTP surface (e2e)', () => {
  let app: INestApplication;
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

  beforeEach(async () => {
    const authService = {
      validateAccessToken: jest.fn().mockResolvedValue(principal),
    };
    const floodReportsService = {
      submit: jest.fn().mockResolvedValue({ reportId: 'report-1', incident: { id: 'incident-1' } }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [FloodReportsController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: FloodReportsService, useValue: floodReportsService },
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

  it('rejects unauthenticated submissions', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    await request(httpServer).post('/api/v1/flood-reports').send({}).expect(401);
  });

  it('routes authenticated submissions to the service', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/api/v1/flood-reports')
      .set('Authorization', 'Bearer access-token')
      .send({
        reportType: 'SEVERE_FLOODING',
        longitude: 3.4,
        latitude: 6.4,
        locationName: 'Test Road',
        description: 'Flood water is blocking the lane',
        observedSeverity: 'SEVERE',
      })
      .expect(201)
      .expect(({ body }: { body: { reportId: string; incident: { id: string } } }) => {
        expect(body.reportId).toBe('report-1');
        expect(body.incident.id).toBe('incident-1');
      });
  });
});

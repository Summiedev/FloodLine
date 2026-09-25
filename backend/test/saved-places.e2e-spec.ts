import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { SavedPlacesController } from '../src/modules/saved-places/saved-places.controller';
import { SavedPlacesService } from '../src/modules/saved-places/saved-places.service';

describe('Saved places HTTP surface (e2e)', () => {
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
      controllers: [SavedPlacesController],
      providers: [
        {
          provide: AuthService,
          useValue: { validateAccessToken: jest.fn().mockResolvedValue(principal) },
        },
        {
          provide: SavedPlacesService,
          useValue: {
            list: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20 } }),
            create: jest.fn().mockResolvedValue({ id: 'place-1', type: 'HOME' }),
            findById: jest.fn().mockResolvedValue({ id: 'place-1', type: 'HOME' }),
            update: jest.fn().mockResolvedValue({ id: 'place-1', type: 'HOME' }),
            delete: jest.fn().mockResolvedValue(undefined),
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
    await request(httpServer).get('/api/v1/saved-places').expect(401);
  });

  it('lists saved places for the authenticated user', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .get('/api/v1/saved-places')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }: { body: { data: unknown[] } }) => expect(body.data).toEqual([]));
  });
});

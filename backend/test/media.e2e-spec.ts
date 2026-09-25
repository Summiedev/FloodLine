import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { MediaController } from '../src/modules/media/media.controller';
import { MediaService } from '../src/modules/media/media.service';

describe('Media HTTP surface (e2e)', () => {
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
      controllers: [MediaController],
      providers: [
        {
          provide: AuthService,
          useValue: { validateAccessToken: jest.fn().mockResolvedValue(principal) },
        },
        {
          provide: MediaService,
          useValue: {
            authorizeUpload: jest
              .fn()
              .mockResolvedValue({ media: { id: 'media-1' }, upload: { url: 'local://upload' } }),
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

  it('rejects unauthenticated upload authorization', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer).post('/api/v1/media/uploads').send({}).expect(401);
  });

  it('validates MIME types at the HTTP boundary', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .post('/api/v1/media/uploads')
      .set('Authorization', 'Bearer access-token')
      .send({
        reportId: '10000000-0000-4000-8000-000000000010',
        contentType: 'image/gif',
        byteSize: 2_048,
      })
      .expect(400);
  });
});

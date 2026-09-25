import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OfficialWarningsController } from '../src/modules/official-warnings/official-warnings.controller';
import { OfficialWarningsService } from '../src/modules/official-warnings/official-warnings.service';

describe('Official warnings HTTP surface (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OfficialWarningsController],
      providers: [
        {
          provide: OfficialWarningsService,
          useValue: {
            toFilters: jest.fn().mockImplementation((query: unknown) => query),
            list: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20 } }),
            findById: jest.fn().mockResolvedValue({ id: 'warning-1' }),
          },
        },
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

  it('lists warnings with active and radius filters', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .get('/api/v1/official-warnings')
      .query({ active: 'true', longitude: '3.4', latitude: '6.4', radiusMeters: '5000' })
      .expect(200)
      .expect(({ body }: { body: { data: unknown[] } }) => {
        expect(body.data).toEqual([]);
      });
  });

  it('gets a warning by ID', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    await request(httpServer)
      .get('/api/v1/official-warnings/10000000-0000-4000-8000-000000000001')
      .expect(200)
      .expect(({ body }: { body: { id: string } }) => expect(body.id).toBe('warning-1'));
  });
});

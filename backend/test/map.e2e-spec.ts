import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MapIncidentsController } from '../src/modules/map/map-incidents.controller';
import { MapIncidentsService } from '../src/modules/map/map-incidents.service';

describe('Map feed (e2e)', () => {
  let app: INestApplication;
  const service = {
    getFeed: jest.fn().mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        limit: 200,
        truncated: false,
        datelineCrossing: false,
        updatedSince: null,
        nextUpdatedSince: '2026-09-26T08:00:00.000Z',
        clustering: 'client-ready',
      },
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MapIncidentsController],
      providers: [{ provide: MapIncidentsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('accepts a viewport and exposes the incremental marker contract', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .get('/api/v1/map/incidents')
      .query({ west: 3.2, south: 6.3, east: 3.6, north: 6.6 });

    expect(response.status).toBe(200);
    expect((response.body as { meta: { clustering: string } }).meta.clustering).toBe(
      'client-ready',
    );
    expect(service.getFeed).toHaveBeenCalled();
  });
});

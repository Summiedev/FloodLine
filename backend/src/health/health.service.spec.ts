import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports readiness when PostgreSQL and Redis are available', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as never;
    const redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as never;
    const service = new HealthService(prisma, redis);

    await expect(service.readiness()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('reports not_ready when a critical dependency is unavailable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as never;
    const redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as never;
    const service = new HealthService(prisma, redis);

    await expect(service.readiness()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        database: { status: 'down', error: 'Dependency unavailable' },
        redis: { status: 'up' },
      },
    });
  });
});

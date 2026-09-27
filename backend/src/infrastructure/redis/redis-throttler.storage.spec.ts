import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('maps the atomic Redis result to the throttler contract', async () => {
    const redis = {
      getClient: () => ({ eval: jest.fn().mockResolvedValue([6, 59_500, 1, 60_000]) }),
    };
    const storage = new RedisThrottlerStorage(redis as never);

    await expect(storage.increment('hashed-key', 60_000, 5, 60_000, 'default')).resolves.toEqual({
      totalHits: 6,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('rejects malformed Redis responses', async () => {
    const redis = {
      getClient: () => ({ eval: jest.fn().mockResolvedValue('bad') }),
    };
    const storage = new RedisThrottlerStorage(redis as never);

    await expect(storage.increment('key', 1_000, 1, 1_000, 'default')).rejects.toThrow(
      'invalid result',
    );
  });
});

import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('accepts the required local development configuration', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://floodline:floodline@localhost:5432/floodline',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'local-development-secret-change-me-please-32',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      RATE_LIMIT_TTL_MS: 60_000,
    });
  });

  it('rejects a configuration without critical dependency URLs', () => {
    expect(() => validateEnvironment({})).toThrow('Environment validation failed');
  });
});

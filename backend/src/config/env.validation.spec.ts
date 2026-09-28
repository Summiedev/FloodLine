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

  it('rejects wildcard CORS origins because credentials are enabled', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://floodline:floodline@localhost:5432/floodline',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'local-development-secret-change-me-please-32',
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS must contain explicit origins');
  });

  it('requires a persistent-geocoding entitlement before enabling Mapbox geocoding', () => {
    const base = {
      DATABASE_URL: 'postgresql://floodline:floodline@localhost:5432/floodline',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'local-development-secret-change-me-please-32',
      MAPBOX_ACCESS_TOKEN: 'sk.test-token',
      GEOCODING_PROVIDER: 'mapbox',
    };

    expect(() => validateEnvironment(base)).toThrow('MAPBOX_GEOCODING_PERMANENT=true');
    expect(validateEnvironment({ ...base, MAPBOX_GEOCODING_PERMANENT: 'true' })).toMatchObject({
      GEOCODING_PROVIDER: 'mapbox',
    });
  });
});

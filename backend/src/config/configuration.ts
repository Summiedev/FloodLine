import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  prefix: process.env.REDIS_PREFIX ?? 'floodline',
}));

export const authConfig = registerAs('auth', () => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET,
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
}));

export const rateLimitConfig = registerAs('rateLimit', () => ({
  ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
  limit: Number(process.env.RATE_LIMIT_LIMIT ?? 100),
}));

export const docsConfig = registerAs('docs', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
}));

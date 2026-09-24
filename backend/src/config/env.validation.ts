import Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().hostname().default('0.0.0.0'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REDIS_PREFIX: Joi.string().default('floodline'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+(s|m|h|d)$/)
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().positive().max(365).default(30),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  RATE_LIMIT_TTL_MS: Joi.number().integer().positive().default(60_000),
  RATE_LIMIT_LIMIT: Joi.number().integer().positive().default(100),
  REPORT_ASSOCIATION_RADIUS_METERS: Joi.number().positive().max(100_000).default(500),
  REPORT_ASSOCIATION_LOOKBACK_MINUTES: Joi.number().integer().positive().max(10_080).default(120),
  REPORT_DUPLICATE_WINDOW_SECONDS: Joi.number().integer().positive().max(86_400).default(60),
  REPORT_DUPLICATE_RADIUS_METERS: Joi.number().positive().max(10_000).default(50),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
}).unknown(true);

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const result = environmentSchema.validate(environment, {
    abortEarly: false,
    convert: true,
  }) as { error?: Joi.ValidationError; value: Record<string, unknown> };

  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  return result.value;
}

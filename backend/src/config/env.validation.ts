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
  MEDIA_STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),
  MEDIA_MAX_BYTES: Joi.number().integer().positive().max(100_000_000).default(10_000_000),
  MEDIA_UPLOAD_URL_TTL_SECONDS: Joi.number().integer().positive().max(86_400).default(900),
  MEDIA_ACCESS_URL_TTL_SECONDS: Joi.number().integer().positive().max(86_400).default(900),
  INCIDENT_CONFIRMATION_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .positive()
    .max(86_400)
    .default(900),
  CONFIDENCE_RECENT_REPORT_WINDOW_HOURS: Joi.number().positive().max(8_760).default(24),
  CONFIDENCE_RECENT_CONFIRMATION_WINDOW_HOURS: Joi.number().positive().max(8_760).default(24),
  CONFIDENCE_STALE_AGE_HOURS: Joi.number().positive().max(8_760).default(72),
  CONFIDENCE_MAX_CONFIRMATIONS: Joi.number().integer().positive().max(1_000).default(5),
  CONFIDENCE_MAX_RECENT_REPORTS: Joi.number().integer().positive().max(1_000).default(5),
  CONFIDENCE_MAX_RECENT_CONFIRMATIONS: Joi.number().integer().positive().max(1_000).default(5),
  CONFIDENCE_MAX_DISTINCT_REPORTERS: Joi.number().integer().positive().max(1_000).default(5),
  CONFIDENCE_MAX_PHOTOS: Joi.number().integer().positive().max(1_000).default(3),
  CONFIDENCE_MAX_CONTRADICTORY_REPORTS: Joi.number().integer().positive().max(1_000).default(2),
  CONFIDENCE_MAX_RESOLUTION_REPORTS: Joi.number().integer().positive().max(1_000).default(2),
  CONFIDENCE_LOW_THRESHOLD: Joi.number().min(0).max(1).default(0.5),
  CONFIDENCE_HIGH_THRESHOLD: Joi.number().min(0).max(1).default(0.75),
  CONFIDENCE_OFFICIAL_MINIMUM_SCORE: Joi.number().min(0).max(1).default(0.85),
  CONFIDENCE_WEIGHT_CONFIRMATIONS: Joi.number().min(0).max(1).default(0.25),
  CONFIDENCE_WEIGHT_REPORT_RECENCY: Joi.number().min(0).max(1).default(0.15),
  CONFIDENCE_WEIGHT_CONFIRMATION_RECENCY: Joi.number().min(0).max(1).default(0.15),
  CONFIDENCE_WEIGHT_DISTINCT_REPORTERS: Joi.number().min(0).max(1).default(0.15),
  CONFIDENCE_WEIGHT_PHOTOS: Joi.number().min(0).max(1).default(0.1),
  CONFIDENCE_WEIGHT_TRUSTED_CONTRIBUTORS: Joi.number().min(0).max(1).default(0.05),
  CONFIDENCE_WEIGHT_OFFICIAL_SOURCE: Joi.number().min(0).max(1).default(0.15),
  CONFIDENCE_PENALTY_CONTRADICTORY_REPORTS: Joi.number().min(0).max(1).default(0.1),
  CONFIDENCE_PENALTY_RESOLUTION_REPORTS: Joi.number().min(0).max(1).default(0.2),
  CONFIDENCE_PENALTY_AGE: Joi.number().min(0).max(1).default(0.1),
  COMMUNITY_INCIDENT_STALE_AFTER_HOURS: Joi.number().positive().max(8_760).default(24),
  COMMUNITY_CONFIRMATION_EXTENSION_HOURS: Joi.number().positive().max(8_760).default(6),
  INCIDENT_EXPIRATION_SWEEP_INTERVAL_MS: Joi.number()
    .integer()
    .positive()
    .min(10_000)
    .max(86_400_000)
    .default(300_000),
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

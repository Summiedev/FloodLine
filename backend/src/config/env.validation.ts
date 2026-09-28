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
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
  S3_REGION: Joi.string().max(64).default('auto'),
  S3_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .optional(),
  S3_ACCESS_KEY_ID: Joi.string().min(8).max(256).optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().min(16).max(512).optional(),
  MEDIA_MAX_BYTES: Joi.number().integer().positive().max(100_000_000).default(10_000_000),
  MEDIA_UPLOAD_URL_TTL_SECONDS: Joi.number().integer().positive().max(86_400).default(900),
  MEDIA_ACCESS_URL_TTL_SECONDS: Joi.number().integer().positive().max(86_400).default(900),
  MEDIA_MAX_ATTACHMENTS_PER_REPORT: Joi.number().integer().positive().max(100).default(10),
  MEDIA_MAX_PHOTOS_PER_INCIDENT: Joi.number().integer().positive().max(1_000).default(100),
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
  ALERT_RADIUS_MIN_METERS: Joi.number().integer().positive().max(100_000).default(500),
  ALERT_RADIUS_MAX_METERS: Joi.number().integer().positive().max(1_000_000).default(100_000),
  ALERT_DEFAULT_RADIUS_METERS: Joi.number().integer().positive().max(1_000_000).default(1_000),
  NOTIFICATION_VERIFICATION_SECRET: Joi.string().min(32).optional(),
  NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY: Joi.string().min(32).optional(),
  NOTIFICATION_CODE_TTL_SECONDS: Joi.number().integer().positive().max(3_600).default(600),
  NOTIFICATION_RESEND_COOLDOWN_SECONDS: Joi.number().integer().positive().max(3_600).default(60),
  NOTIFICATION_MAX_VERIFICATION_ATTEMPTS: Joi.number().integer().positive().max(20).default(5),
  ALERT_EVALUATION_BATCH_SIZE: Joi.number().integer().positive().max(1_000).default(250),
  PUSH_NOTIFICATION_PROVIDER: Joi.string().valid('local', 'fcm').default('local'),
  SMS_NOTIFICATION_PROVIDER: Joi.string().valid('local', 'twilio').default('local'),
  WHATSAPP_NOTIFICATION_PROVIDER: Joi.string().valid('local', 'twilio').default('local'),
  FIREBASE_PROJECT_ID: Joi.string().max(256).optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().max(320).optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().min(100).max(16_384).optional(),
  TWILIO_ACCOUNT_SID: Joi.string()
    .pattern(/^AC[0-9a-fA-F]{32}$/)
    .optional(),
  TWILIO_API_KEY_SID: Joi.string()
    .pattern(/^SK[0-9a-fA-F]{32}$/)
    .optional(),
  TWILIO_API_KEY_SECRET: Joi.string().min(16).max(256).optional(),
  TWILIO_SMS_FROM: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .optional(),
  TWILIO_WHATSAPP_FROM: Joi.string()
    .pattern(/^whatsapp:\+[1-9]\d{6,14}$/)
    .optional(),
  ROUTING_PROVIDER: Joi.string().valid('local', 'mapbox').default('local'),
  MAPBOX_ACCESS_TOKEN: Joi.string()
    .pattern(/^(pk|sk)\.[A-Za-z0-9._-]+$/)
    .optional(),
  MAPBOX_DRIVING_PROFILE: Joi.string()
    .valid('mapbox/driving', 'mapbox/driving-traffic')
    .default('mapbox/driving-traffic'),
  ROUTING_TIMEOUT_MS: Joi.number().integer().positive().min(250).max(30_000).default(8_000),
  ROUTING_CACHE_TTL_SECONDS: Joi.number().integer().min(0).max(3_600).default(60),
  ROUTE_RISK_CORRIDOR_METERS: Joi.number().positive().max(2_000).default(250),
  ROUTE_RISK_RECENCY_WINDOW_HOURS: Joi.number().positive().max(8_760).default(72),
  ROUTE_RISK_LOW_THRESHOLD: Joi.number().min(0).max(1).default(0.3),
  ROUTE_RISK_HIGH_THRESHOLD: Joi.number().min(0).max(1).default(0.7),
  ROUTE_RECOMMENDATION_RISK_WEIGHT: Joi.number().min(0).max(1).default(0.7),
  ROUTE_RECOMMENDATION_DURATION_WEIGHT: Joi.number().min(0).max(1).default(0.2),
  ROUTE_RECOMMENDATION_DISTANCE_WEIGHT: Joi.number().min(0).max(1).default(0.1),
  ROUTE_RECOMMENDATION_MAX_DURATION_OVERHEAD_RATIO: Joi.number().min(0).max(5).default(0.5),
  ROUTE_RECOMMENDATION_MIN_RISK_IMPROVEMENT: Joi.number().min(0).max(1).default(0.1),
  NAVIGATION_SESSION_TTL_MINUTES: Joi.number().integer().positive().max(1_440).default(120),
  NAVIGATION_REROUTE_COOLDOWN_SECONDS: Joi.number().integer().positive().max(86_400).default(300),
  NAVIGATION_MIN_RISK_IMPROVEMENT: Joi.number().min(0).max(1).default(0.1),
  NAVIGATION_MAX_DURATION_OVERHEAD_RATIO: Joi.number().min(0).max(5).default(0.5),
  NAVIGATION_EVALUATION_BATCH_SIZE: Joi.number().integer().positive().max(1_000).default(100),
  CONTRIBUTOR_ADMIN_USER_IDS: Joi.string().default(''),
  GEOCODING_PROVIDER: Joi.string().valid('local', 'mapbox').default('local'),
  MAPBOX_GEOCODING_COUNTRY: Joi.string()
    .pattern(/^[a-z]{2}$/i)
    .default('ng'),
  MAPBOX_GEOCODING_PERMANENT: Joi.boolean().truthy('true').falsy('false').default(false),
  GEOCODING_TIMEOUT_MS: Joi.number().integer().positive().min(250).max(30_000).default(5_000),
  GEOCODING_CACHE_TTL_SECONDS: Joi.number().integer().min(0).max(86_400).default(300),
  OFFICIAL_WARNING_PROVIDER_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .min(250)
    .max(60_000)
    .default(10_000),
  OFFICIAL_WARNING_MAX_FEED_ITEMS: Joi.number().integer().positive().max(10_000).default(1_000),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  METRICS_ACCESS_TOKEN: Joi.string().min(32).optional(),
  JOBS_PROCESSOR_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
}).unknown(true);

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const result = environmentSchema.validate(environment, {
    abortEarly: false,
    convert: true,
  }) as { error?: Joi.ValidationError; value: Record<string, unknown> };

  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  const configuredOrigins = result.value.CORS_ORIGINS;
  const origins = (typeof configuredOrigins === 'string' ? configuredOrigins : '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('Environment validation failed: CORS_ORIGINS must contain explicit origins');
  }
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/') {
        throw new Error('unsupported origin');
      }
    } catch {
      throw new Error(`Environment validation failed: invalid CORS origin ${origin}`);
    }
  }

  const needsS3 = result.value.MEDIA_STORAGE_PROVIDER === 's3';
  if (
    needsS3 &&
    (!result.value.S3_ENDPOINT ||
      !result.value.S3_BUCKET ||
      !result.value.S3_ACCESS_KEY_ID ||
      !result.value.S3_SECRET_ACCESS_KEY)
  ) {
    throw new Error(
      'Environment validation failed: S3 storage requires endpoint, bucket, and credentials',
    );
  }
  const needsMapbox =
    result.value.ROUTING_PROVIDER === 'mapbox' || result.value.GEOCODING_PROVIDER === 'mapbox';
  if (needsMapbox && !result.value.MAPBOX_ACCESS_TOKEN) {
    throw new Error(
      'Environment validation failed: Mapbox routing or geocoding requires MAPBOX_ACCESS_TOKEN',
    );
  }
  if (result.value.GEOCODING_PROVIDER === 'mapbox' && !result.value.MAPBOX_GEOCODING_PERMANENT) {
    throw new Error(
      'Environment validation failed: FloodLine stores selected locations, so Mapbox geocoding requires MAPBOX_GEOCODING_PERMANENT=true',
    );
  }
  if (
    result.value.PUSH_NOTIFICATION_PROVIDER === 'fcm' &&
    (!result.value.FIREBASE_PROJECT_ID ||
      !result.value.FIREBASE_CLIENT_EMAIL ||
      !result.value.FIREBASE_PRIVATE_KEY)
  ) {
    throw new Error('Environment validation failed: FCM requires Firebase service-account values');
  }
  const needsTwilio =
    result.value.SMS_NOTIFICATION_PROVIDER === 'twilio' ||
    result.value.WHATSAPP_NOTIFICATION_PROVIDER === 'twilio';
  if (
    needsTwilio &&
    (!result.value.TWILIO_ACCOUNT_SID ||
      !result.value.TWILIO_API_KEY_SID ||
      !result.value.TWILIO_API_KEY_SECRET ||
      (result.value.SMS_NOTIFICATION_PROVIDER === 'twilio' && !result.value.TWILIO_SMS_FROM) ||
      (result.value.WHATSAPP_NOTIFICATION_PROVIDER === 'twilio' &&
        !result.value.TWILIO_WHATSAPP_FROM))
  ) {
    throw new Error(
      'Environment validation failed: Twilio providers require account, API-key, and sender values',
    );
  }

  return result.value;
}

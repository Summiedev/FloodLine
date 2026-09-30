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
  connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),
  transactionMaxWaitMs: Number(process.env.DATABASE_TRANSACTION_MAX_WAIT_MS ?? 15_000),
  transactionTimeoutMs: Number(process.env.DATABASE_TRANSACTION_TIMEOUT_MS ?? 15_000),
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

export const metricsConfig = registerAs('metrics', () => ({
  enabled: process.env.METRICS_ENABLED !== 'false',
  accessToken: process.env.METRICS_ACCESS_TOKEN,
}));

export const floodReportConfig = registerAs('floodReport', () => ({
  associationRadiusMeters: Number(process.env.REPORT_ASSOCIATION_RADIUS_METERS ?? 500),
  associationLookbackMinutes: Number(process.env.REPORT_ASSOCIATION_LOOKBACK_MINUTES ?? 120),
  duplicateWindowSeconds: Number(process.env.REPORT_DUPLICATE_WINDOW_SECONDS ?? 60),
  duplicateRadiusMeters: Number(process.env.REPORT_DUPLICATE_RADIUS_METERS ?? 50),
}));

export const mediaConfig = registerAs('media', () => ({
  storageProvider: process.env.MEDIA_STORAGE_PROVIDER ?? 'local',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  maxBytes: Number(process.env.MEDIA_MAX_BYTES ?? 10_000_000),
  uploadUrlTtlSeconds: Number(process.env.MEDIA_UPLOAD_URL_TTL_SECONDS ?? 900),
  accessUrlTtlSeconds: Number(process.env.MEDIA_ACCESS_URL_TTL_SECONDS ?? 900),
  maxAttachmentsPerReport: Number(process.env.MEDIA_MAX_ATTACHMENTS_PER_REPORT ?? 10),
  maxPhotosPerIncident: Number(process.env.MEDIA_MAX_PHOTOS_PER_INCIDENT ?? 100),
}));

export const incidentConfirmationConfig = registerAs('incidentConfirmation', () => ({
  cooldownSeconds: Number(process.env.INCIDENT_CONFIRMATION_COOLDOWN_SECONDS ?? 900),
}));

export const incidentConfidenceConfig = registerAs('incidentConfidence', () => ({
  recentReportWindowHours: Number(process.env.CONFIDENCE_RECENT_REPORT_WINDOW_HOURS ?? 24),
  recentConfirmationWindowHours: Number(
    process.env.CONFIDENCE_RECENT_CONFIRMATION_WINDOW_HOURS ?? 24,
  ),
  staleAgeHours: Number(process.env.CONFIDENCE_STALE_AGE_HOURS ?? 72),
  maximumConfirmations: Number(process.env.CONFIDENCE_MAX_CONFIRMATIONS ?? 5),
  maximumRecentReports: Number(process.env.CONFIDENCE_MAX_RECENT_REPORTS ?? 5),
  maximumRecentConfirmations: Number(process.env.CONFIDENCE_MAX_RECENT_CONFIRMATIONS ?? 5),
  maximumDistinctReporters: Number(process.env.CONFIDENCE_MAX_DISTINCT_REPORTERS ?? 5),
  maximumPhotos: Number(process.env.CONFIDENCE_MAX_PHOTOS ?? 3),
  maximumContradictoryReports: Number(process.env.CONFIDENCE_MAX_CONTRADICTORY_REPORTS ?? 2),
  maximumResolutionReports: Number(process.env.CONFIDENCE_MAX_RESOLUTION_REPORTS ?? 2),
  lowThreshold: Number(process.env.CONFIDENCE_LOW_THRESHOLD ?? 0.5),
  highThreshold: Number(process.env.CONFIDENCE_HIGH_THRESHOLD ?? 0.75),
  officialMinimumScore: Number(process.env.CONFIDENCE_OFFICIAL_MINIMUM_SCORE ?? 0.85),
  weightConfirmations: Number(process.env.CONFIDENCE_WEIGHT_CONFIRMATIONS ?? 0.25),
  weightReportRecency: Number(process.env.CONFIDENCE_WEIGHT_REPORT_RECENCY ?? 0.15),
  weightConfirmationRecency: Number(process.env.CONFIDENCE_WEIGHT_CONFIRMATION_RECENCY ?? 0.15),
  weightDistinctReporters: Number(process.env.CONFIDENCE_WEIGHT_DISTINCT_REPORTERS ?? 0.15),
  weightPhotos: Number(process.env.CONFIDENCE_WEIGHT_PHOTOS ?? 0.1),
  weightTrustedContributors: Number(process.env.CONFIDENCE_WEIGHT_TRUSTED_CONTRIBUTORS ?? 0.05),
  weightOfficialSource: Number(process.env.CONFIDENCE_WEIGHT_OFFICIAL_SOURCE ?? 0.15),
  penaltyContradictoryReports: Number(process.env.CONFIDENCE_PENALTY_CONTRADICTORY_REPORTS ?? 0.1),
  penaltyResolutionReports: Number(process.env.CONFIDENCE_PENALTY_RESOLUTION_REPORTS ?? 0.2),
  penaltyAge: Number(process.env.CONFIDENCE_PENALTY_AGE ?? 0.1),
}));

export const incidentLifecycleConfig = registerAs('incidentLifecycle', () => ({
  communityStaleAfterHours: Number(process.env.COMMUNITY_INCIDENT_STALE_AFTER_HOURS ?? 24),
  confirmationExtensionHours: Number(process.env.COMMUNITY_CONFIRMATION_EXTENSION_HOURS ?? 6),
  expirationSweepIntervalMs: Number(process.env.INCIDENT_EXPIRATION_SWEEP_INTERVAL_MS ?? 300_000),
}));

export const alertPreferenceConfig = registerAs('alertPreference', () => ({
  minimumRadiusMeters: Number(process.env.ALERT_RADIUS_MIN_METERS ?? 500),
  maximumRadiusMeters: Number(process.env.ALERT_RADIUS_MAX_METERS ?? 100_000),
  defaultRadiusMeters: Number(process.env.ALERT_DEFAULT_RADIUS_METERS ?? 1_000),
}));

export const notificationConfig = registerAs('notification', () => ({
  verificationSecret: process.env.NOTIFICATION_VERIFICATION_SECRET ?? process.env.JWT_ACCESS_SECRET,
  deviceTokenEncryptionKey:
    process.env.NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY ??
    process.env.NOTIFICATION_VERIFICATION_SECRET ??
    process.env.JWT_ACCESS_SECRET,
  verificationCodeTtlSeconds: Number(process.env.NOTIFICATION_CODE_TTL_SECONDS ?? 600),
  verificationResendCooldownSeconds: Number(process.env.NOTIFICATION_RESEND_COOLDOWN_SECONDS ?? 60),
  verificationMaxAttempts: Number(process.env.NOTIFICATION_MAX_VERIFICATION_ATTEMPTS ?? 5),
  evaluationBatchSize: Number(process.env.ALERT_EVALUATION_BATCH_SIZE ?? 250),
  pushProvider: process.env.PUSH_NOTIFICATION_PROVIDER ?? 'local',
  smsProvider: process.env.SMS_NOTIFICATION_PROVIDER ?? 'local',
  whatsappProvider: process.env.WHATSAPP_NOTIFICATION_PROVIDER ?? 'local',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    smsFrom: process.env.TWILIO_SMS_FROM,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
  },
}));

export const routingConfig = registerAs('routing', () => ({
  provider: process.env.ROUTING_PROVIDER ?? 'local',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
  mapboxDrivingProfile: process.env.MAPBOX_DRIVING_PROFILE ?? 'mapbox/driving-traffic',
  timeoutMs: Number(process.env.ROUTING_TIMEOUT_MS ?? 8_000),
  cacheTtlSeconds: Number(process.env.ROUTING_CACHE_TTL_SECONDS ?? 60),
}));

export const routeRiskConfig = registerAs('routeRisk', () => ({
  corridorMeters: Number(process.env.ROUTE_RISK_CORRIDOR_METERS ?? 250),
  recentWindowHours: Number(process.env.ROUTE_RISK_RECENCY_WINDOW_HOURS ?? 72),
  lowThreshold: Number(process.env.ROUTE_RISK_LOW_THRESHOLD ?? 0.3),
  highThreshold: Number(process.env.ROUTE_RISK_HIGH_THRESHOLD ?? 0.7),
}));

export const routeRecommendationConfig = registerAs('routeRecommendation', () => ({
  riskWeight: Number(process.env.ROUTE_RECOMMENDATION_RISK_WEIGHT ?? 0.7),
  durationWeight: Number(process.env.ROUTE_RECOMMENDATION_DURATION_WEIGHT ?? 0.2),
  distanceWeight: Number(process.env.ROUTE_RECOMMENDATION_DISTANCE_WEIGHT ?? 0.1),
  maximumDurationOverheadRatio: Number(
    process.env.ROUTE_RECOMMENDATION_MAX_DURATION_OVERHEAD_RATIO ?? 0.5,
  ),
  minimumRiskImprovement: Number(process.env.ROUTE_RECOMMENDATION_MIN_RISK_IMPROVEMENT ?? 0.1),
}));

export const navigationConfig = registerAs('navigation', () => ({
  sessionTtlMinutes: Number(process.env.NAVIGATION_SESSION_TTL_MINUTES ?? 120),
  rerouteCooldownSeconds: Number(process.env.NAVIGATION_REROUTE_COOLDOWN_SECONDS ?? 300),
  minimumRiskImprovement: Number(process.env.NAVIGATION_MIN_RISK_IMPROVEMENT ?? 0.1),
  maximumDurationOverheadRatio: Number(process.env.NAVIGATION_MAX_DURATION_OVERHEAD_RATIO ?? 0.5),
  evaluationBatchSize: Number(process.env.NAVIGATION_EVALUATION_BATCH_SIZE ?? 100),
}));

export const contributorConfig = registerAs('contributor', () => ({
  adminUserIds: (process.env.CONTRIBUTOR_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean),
}));

export const geocodingConfig = registerAs('geocoding', () => ({
  provider: process.env.GEOCODING_PROVIDER ?? 'local',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
  mapboxCountry: process.env.MAPBOX_GEOCODING_COUNTRY ?? 'ng',
  mapboxPermanent: process.env.MAPBOX_GEOCODING_PERMANENT === 'true',
  timeoutMs: Number(process.env.GEOCODING_TIMEOUT_MS ?? 5_000),
  cacheTtlSeconds: Number(process.env.GEOCODING_CACHE_TTL_SECONDS ?? 300),
}));

export const officialWarningConfig = registerAs('officialWarning', () => ({
  providerTimeoutMs: Number(process.env.OFFICIAL_WARNING_PROVIDER_TIMEOUT_MS ?? 10_000),
  maxFeedItems: Number(process.env.OFFICIAL_WARNING_MAX_FEED_ITEMS ?? 1_000),
}));

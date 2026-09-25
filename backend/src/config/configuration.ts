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

export const floodReportConfig = registerAs('floodReport', () => ({
  associationRadiusMeters: Number(process.env.REPORT_ASSOCIATION_RADIUS_METERS ?? 500),
  associationLookbackMinutes: Number(process.env.REPORT_ASSOCIATION_LOOKBACK_MINUTES ?? 120),
  duplicateWindowSeconds: Number(process.env.REPORT_DUPLICATE_WINDOW_SECONDS ?? 60),
  duplicateRadiusMeters: Number(process.env.REPORT_DUPLICATE_RADIUS_METERS ?? 50),
}));

export const mediaConfig = registerAs('media', () => ({
  storageProvider: process.env.MEDIA_STORAGE_PROVIDER ?? 'local',
  maxBytes: Number(process.env.MEDIA_MAX_BYTES ?? 10_000_000),
  uploadUrlTtlSeconds: Number(process.env.MEDIA_UPLOAD_URL_TTL_SECONDS ?? 900),
  accessUrlTtlSeconds: Number(process.env.MEDIA_ACCESS_URL_TTL_SECONDS ?? 900),
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

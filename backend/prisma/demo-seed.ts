import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { redisConnectionFromUrl } from '../src/infrastructure/redis/redis.connection';

const DEMO_HAZARD_ID = '10000000-0000-4000-8000-000000000010';
const DEMO_WARNING_ID = '10000000-0000-4000-8000-000000000021';
const DEMO_ORIGIN = { longitude: 3.3792, latitude: 6.5244 };
const DEMO_DESTINATION = { longitude: 3.4219, latitude: 6.4281 };

type DemoIncident = {
  id: string;
  incidentType: 'SEVERE_FLOODING' | 'MODERATE_FLOODING' | 'BLOCKED_ROAD' | 'BLOCKED_DRAIN';
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  longitude: number;
  latitude: number;
  locationName: string;
  description: string;
  confidenceScore: number;
  confidenceLabel: 'LOW' | 'MEDIUM' | 'HIGH';
  confirmationCount: number;
  photoCount: number;
};

const demoIncidents: DemoIncident[] = [
  {
    id: '10000000-0000-4000-8000-000000000011',
    incidentType: 'MODERATE_FLOODING',
    severity: 'MODERATE',
    longitude: 3.4055,
    latitude: 6.5205,
    locationName: 'Demo · Admiralty Way, Lekki Phase 1',
    description: 'Demo data: standing water is slowing traffic near the junction.',
    confidenceScore: 0.82,
    confidenceLabel: 'HIGH',
    confirmationCount: 8,
    photoCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000012',
    incidentType: 'BLOCKED_DRAIN',
    severity: 'MODERATE',
    longitude: 3.355,
    latitude: 6.49,
    locationName: 'Demo · Ahmadu Bello Way',
    description: 'Demo data: a blocked drain is causing water to collect beside the road.',
    confidenceScore: 0.68,
    confidenceLabel: 'MEDIUM',
    confirmationCount: 4,
    photoCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000013',
    incidentType: 'BLOCKED_ROAD',
    severity: 'HIGH',
    longitude: 3.426,
    latitude: 6.495,
    locationName: 'Demo · Ikoyi access road',
    description: 'Demo data: a partially blocked lane is causing vehicles to merge.',
    confidenceScore: 0.74,
    confidenceLabel: 'MEDIUM',
    confirmationCount: 5,
    photoCount: 0,
  },
];

function loadEnvironment(): void {
  const processWithLoader = process as NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
  };
  processWithLoader.loadEnvFile?.('.env');
}

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required for the demo seed');
  const url = new URL(configured);
  if (url.port === '6543') {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '1');
  }
  return url.toString();
}

loadEnvironment();
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

async function upsertIncident(
  incident: DemoIncident,
  now: Date,
  status: 'ACTIVE' | 'EXPIRED',
  expiresAt: Date,
): Promise<void> {
  const firstReportedAt = new Date(now.getTime() - 15 * 60_000);
  await prisma.$executeRaw`
    INSERT INTO "incidents" (
      "id", "incident_type", "severity", "status", "location", "location_name",
      "description", "confidence_score", "confidence_label", "source_type",
      "confirmation_count", "photo_count", "first_reported_at", "expires_at",
      "created_at", "updated_at"
    ) VALUES (
      ${incident.id}::uuid,
      CAST(${incident.incidentType} AS "IncidentType"),
      CAST(${incident.severity} AS "IncidentSeverity"),
      CAST(${status} AS "IncidentStatus"),
      ST_SetSRID(ST_MakePoint(${incident.longitude}, ${incident.latitude}), 4326)::geography,
      ${incident.locationName},
      ${incident.description},
      ${incident.confidenceScore},
      CAST(${incident.confidenceLabel} AS "IncidentConfidenceLabel"),
      CAST('COMMUNITY' AS "IncidentSourceType"),
      ${incident.confirmationCount},
      ${incident.photoCount},
      ${firstReportedAt},
      ${expiresAt},
      ${now},
      ${now}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "incident_type" = EXCLUDED."incident_type",
      "severity" = EXCLUDED."severity",
      "status" = EXCLUDED."status",
      "location" = EXCLUDED."location",
      "location_name" = EXCLUDED."location_name",
      "description" = EXCLUDED."description",
      "confidence_score" = EXCLUDED."confidence_score",
      "confidence_label" = EXCLUDED."confidence_label",
      "source_type" = EXCLUDED."source_type",
      "confirmation_count" = EXCLUDED."confirmation_count",
      "photo_count" = EXCLUDED."photo_count",
      "first_reported_at" = EXCLUDED."first_reported_at",
      "resolved_at" = NULL,
      "expires_at" = EXCLUDED."expires_at",
      "updated_at" = EXCLUDED."updated_at"
  `;
}

async function upsertOfficialWarning(now: Date, expiresAt: Date): Promise<void> {
  const issuedAt = new Date(now.getTime() - 8 * 60_000);
  await prisma.$executeRaw`
    INSERT INTO "official_warnings" (
      "id", "authority", "external_id", "title", "description", "severity", "status",
      "affected_geometry", "issued_at", "effective_at", "expires_at", "source_url",
      "raw_provider_metadata", "created_at", "updated_at"
    ) VALUES (
      ${DEMO_WARNING_ID}::uuid,
      'FloodLine Demo Authority',
      'floodline-demo-warning-001',
      'Controlled advisory: flooding near coastal routes',
      'Demo-only official warning covering the Lagos route scenario. Use it to demonstrate how an authority warning appears alongside community reports.',
      CAST('SEVERE' AS "IncidentSeverity"),
      CAST('ACTIVE' AS "OfficialWarningStatus"),
      ST_GeomFromText('POLYGON((3.36 6.43, 3.44 6.43, 3.44 6.54, 3.36 6.54, 3.36 6.43))', 4326),
      ${issuedAt},
      ${issuedAt},
      ${expiresAt},
      NULL,
      '{"demo": true, "provider": "controlled-seed"}'::jsonb,
      ${now},
      ${now}
    )
    ON CONFLICT ("authority", "external_id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "severity" = EXCLUDED."severity",
      "status" = EXCLUDED."status",
      "affected_geometry" = EXCLUDED."affected_geometry",
      "issued_at" = EXCLUDED."issued_at",
      "effective_at" = EXCLUDED."effective_at",
      "expires_at" = EXCLUDED."expires_at",
      "source_url" = EXCLUDED."source_url",
      "raw_provider_metadata" = EXCLUDED."raw_provider_metadata",
      "updated_at" = EXCLUDED."updated_at"
  `;
}

async function clearDemoRouteCache(): Promise<void> {
  if (!process.env.REDIS_URL) return;
  const normalized = JSON.stringify({
    provider: process.env.ROUTING_PROVIDER ?? 'local',
    origin: { longitude: Number(DEMO_ORIGIN.longitude.toFixed(5)), latitude: Number(DEMO_ORIGIN.latitude.toFixed(5)) },
    destination: { longitude: Number(DEMO_DESTINATION.longitude.toFixed(5)), latitude: Number(DEMO_DESTINATION.latitude.toFixed(5)) },
    waypoints: [],
    travelMode: 'DRIVING',
  });
  const redis = new Redis({ ...redisConnectionFromUrl(process.env.REDIS_URL), lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`routing:preview:v2:${createHash('sha256').update(normalized).digest('hex')}`);
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  const now = new Date();
  const activeUntil = new Date(now.getTime() + 6 * 60 * 60_000);
  const dormantHazard: DemoIncident = {
    id: DEMO_HAZARD_ID,
    incidentType: 'SEVERE_FLOODING',
    severity: 'SEVERE',
    // This point sits on the faster Mapbox route for the documented demo trip:
    // 3.3792,6.5244 (Lekki Phase 1) -> 3.4219,6.4281 (Victoria Island).
    longitude: 3.375308,
    latitude: 6.475396,
    locationName: 'Demo · flood hazard on the fast route',
    description: 'Demo trigger: reported water is near vehicle bonnet level on this route.',
    confidenceScore: 0.9,
    confidenceLabel: 'HIGH',
    confirmationCount: 14,
    photoCount: 0,
  };

  for (const incident of demoIncidents) {
    await upsertIncident(incident, now, 'ACTIVE', activeUntil);
  }

  await upsertOfficialWarning(now, activeUntil);

  // Reset the route hazard to EXPIRED so the first route preview is clean. The
  // trigger command activates this same stable ID after navigation starts.
  await upsertIncident(
    dormantHazard,
    now,
    'EXPIRED',
    new Date(now.getTime() - 60_000),
  );
  await clearDemoRouteCache();

  console.log(
    JSON.stringify({
      message: 'FloodLine Lagos demo dataset is ready',
      activeIncidents: demoIncidents.length,
      activeOfficialWarnings: 1,
      officialWarningId: DEMO_WARNING_ID,
      dormantNavigationHazardId: DEMO_HAZARD_ID,
      demoTrip: {
        origin: DEMO_ORIGIN,
        destination: DEMO_DESTINATION,
        travelMode: 'DRIVING',
      },
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

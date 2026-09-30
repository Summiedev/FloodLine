import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { redisConnectionFromUrl } from '../src/infrastructure/redis/redis.connection';
import { QUEUE_NAMES } from '../src/infrastructure/queue/queue.constants';
import { NAVIGATION_EVALUATE_INCIDENT_JOB } from '../src/modules/navigation/navigation.constants';
import { ALERT_EVALUATE_INCIDENT_JOB } from '../src/modules/notifications/notification.constants';

const DEMO_HAZARD_ID = '10000000-0000-4000-8000-000000000010';
const DEMO_ORIGIN = { longitude: 3.3792, latitude: 6.5244 };
const DEMO_DESTINATION = { longitude: 3.4219, latitude: 6.4281 };

function loadEnvironment(): void {
  const processWithLoader = process as NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
  };
  processWithLoader.loadEnvFile?.('.env');
}

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required for the demo trigger');
  const url = new URL(configured);
  if (url.port === '6543') {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '1');
  }
  return url.toString();
}

loadEnvironment();
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

async function activateHazard(now: Date): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "incidents"
    SET "status" = CAST('ACTIVE' AS "IncidentStatus"),
        "resolved_at" = NULL,
        "expires_at" = ${new Date(now.getTime() + 4 * 60 * 60_000)},
        "updated_at" = ${now}
    WHERE "id" = ${DEMO_HAZARD_ID}::uuid
  `;
  const exists = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text AS id FROM "incidents" WHERE "id" = ${DEMO_HAZARD_ID}::uuid LIMIT 1
  `;
  if (!exists[0]) {
    throw new Error('Demo hazard is missing. Run npm run demo:seed first.');
  }
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

async function enqueue(queue: Queue, name: string, eventId: string): Promise<void> {
  const jobId = `${name.replaceAll('.', '-')}-${DEMO_HAZARD_ID}-${eventId}`;
  await queue.add(
    name,
    {
      jobId,
      correlationId: `demo-${eventId}`,
      enqueuedAt: new Date().toISOString(),
      payload: { incidentId: DEMO_HAZARD_ID },
    },
    { jobId, attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
  );
}

async function main(): Promise<void> {
  loadEnvironment();
  const eventId = Date.now().toString();
  await activateHazard(new Date());
  await clearDemoRouteCache();
  const queue = new Queue(QUEUE_NAMES.System, {
    connection: {
      ...redisConnectionFromUrl(process.env.REDIS_URL ?? ''),
      skipVersionCheck: true,
    },
  });
  try {
    await enqueue(queue, NAVIGATION_EVALUATE_INCIDENT_JOB, eventId);
    await enqueue(queue, ALERT_EVALUATE_INCIDENT_JOB, `${eventId}-${randomUUID().slice(0, 8)}`);
  } finally {
    await queue.close();
  }
  console.log(
    JSON.stringify({
      message: 'Demo hazard activated and evaluation jobs queued',
      incidentId: DEMO_HAZARD_ID,
      note: 'The worker will evaluate active navigation sessions asynchronously.',
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

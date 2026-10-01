# FloodLine

FloodLine is a hyperlocal flood-mobility assistant. It combines community reports, official warnings, saved-place alerts, route-risk evaluation, and active-navigation monitoring to help people make better travel decisions during flooding.

## Repository layout

```text
.
├── backend/       NestJS API, Prisma/PostGIS migrations, tests, jobs, and demo tooling
├── frontend/      Vite/React web client with Mapbox maps and route flows
└── README.md      Developer and judge onboarding
```

Backend architecture and API notes are in [`backend/README.md`](backend/README.md). Security and residual risks are documented in [`backend/SECURITY.md`](backend/SECURITY.md).

## Implemented product areas

- Email/password authentication with revocable refresh sessions
- Canonical flood incidents and PostGIS map/radius/bounding-box queries
- Authenticated community flood reports and confirmations
- Secure image-media authorization with local and S3-compatible providers
- Official-warning ingestion with idempotent provider/external-ID upserts
- Saved places and configurable alert preferences
- Notification destinations, verified phone/WhatsApp state, alert evaluation, and delivery records
- Map feed with incremental refresh support
- Provider-neutral geocoding and routing
- Deterministic flood-risk scoring and lower reported-risk route recommendations
- Active navigation sessions with asynchronous hazard monitoring and reroute updates
- Community impact, contributor status, and in-app alert history
- Structured logging, metrics, health/readiness checks, BullMQ jobs, and a persistent worker

FloodLine does not claim that a route is guaranteed safe. The product uses language such as `lower reported flood risk`, `flood reports detected`, and `no currently known reports`.

## Prerequisites

- Node.js 20 or newer
- Managed PostgreSQL with PostGIS and Redis, or Docker Desktop with Docker Compose
- A Mapbox token for live maps, geocoding, and road-network routing

## No-Docker development with Supabase and Upstash

Copy `backend/.env.example` to `backend/.env` and set your managed database, Redis, CORS, Mapbox, and authentication values. Never commit `.env` or paste secrets into source control.

Apply migrations and start the API:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\backend
npm install
npm run db:generate
npm run db:migrate
npm run start:dev
```

Start the persistent worker in a second terminal:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\backend
npm run worker
```

Start the frontend in a third terminal:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open:

- Frontend: `http://127.0.0.1:5173`
- API liveness: `http://127.0.0.1:3000/api/v1/health`
- API readiness: `http://127.0.0.1:3000/api/v1/health/ready`
- Swagger: `http://127.0.0.1:3000/docs`

Docker is optional. If using local dependencies instead:

```powershell
Set-Location backend
docker compose up -d postgres redis
npm run db:migrate
```

For Supabase's transaction pooler on port `6543`, the application automatically adds Prisma's `pgbouncer=true` settings. If migration locking is problematic, use Supabase's session/direct connection on port `5432` for `npm run db:migrate`.

## Controlled hackathon demo

The demo dataset is synthetic and clearly marked `Demo`; it is not live authority data. It creates three visible Lagos incidents and keeps a fourth route hazard dormant until navigation has started.

Reset the scenario:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\backend
npm run demo:seed
```

The frontend has a `Use controlled Lagos demo trip` action when `VITE_DEMO_MODE=true`. It uses the deterministic inland Ikeja to Yaba trip so the recording does not depend on the judge's GPS location or a coastal road.

To activate the route hazard after starting navigation:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\backend
npm run demo:trigger-hazard
```

The BullMQ worker then evaluates the active route asynchronously using the real PostGIS corridor query and creates a route update when the lower reported-risk alternative meets policy. The frontend notification simulator is explicitly presentation-only and does not send SMS, WhatsApp, or push messages.

Read the full recording sequence and truthful demo wording in [`backend/DEMO_RUNBOOK.md`](backend/DEMO_RUNBOOK.md).

The Remotion presentation video uses the same controlled seeded scenario and
can be rendered with:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\demo-video
npm install
npm run typecheck
npm run render
```

The MP4 is written to `demo-video/out/floodline-demo.mp4`. It is a deterministic
presentation artifact; it does not send external notifications or claim that
the seeded records are live authority data.

## Production deployment shape

- Frontend: Vercel
- API: Vercel Functions or a long-lived Node service
- PostgreSQL/PostGIS: Supabase or another managed provider
- Redis/BullMQ: Upstash or another managed Redis provider
- Worker: Railway, Render, Fly.io, or another persistent Node service
- Media: private S3-compatible storage such as Cloudflare R2

Vercel does not provide a permanent BullMQ worker process. Set `JOBS_PROCESSOR_ENABLED=false` for the Vercel API and run `npm run worker` separately with `JOBS_PROCESSOR_ENABLED=true`.

## Verification commands

Run from `backend/`:

```powershell
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

Run from `frontend/`:

```powershell
npm run typecheck
npm run build
```

All database changes must be committed as Prisma migrations. Do not edit an already-applied migration.

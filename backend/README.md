# FloodLine backend

This repository contains the production backend foundation for FloodLine. Authentication, basic user accounts, flood incidents, community reports, notification infrastructure, map feeds, route previews with reported flood-risk evaluation, safer-route selection, and active-navigation monitoring are implemented.

## Architecture

- NestJS + TypeScript application under `src/`.
- Prisma is used for PostgreSQL access and migrations.
- The first migration enables PostGIS; domain migrations should be owned by their feature modules.
- Redis is exposed through `RedisService` and BullMQ through `QueueService`.
- HTTP is versioned at `/api/v1`.
- `/api/v1/health` is a liveness check; `/api/v1/health/ready` verifies PostgreSQL and Redis.
- Swagger UI is available at `/docs` when `SWAGGER_ENABLED` is not `false`.
- Authentication currently uses email/password, Argon2id password hashes, short-lived JWT access tokens, and rotating opaque refresh sessions.
- Password credentials, refresh-token hashes, and audit records are stored separately from the public user representation.

## Authentication API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `PATCH /api/v1/me` — currently updates `displayName` only.

Authentication endpoints have a stricter rate limit than the global API limit. Refresh-token rotation is atomic, and revoking a session immediately invalidates access tokens tied to that session.

## Community flood reports

- `POST /api/v1/flood-reports` requires a bearer access token.
- Reports are stored separately from canonical incidents in `flood_reports` with pending moderation status.
- The server validates locations and observed data, derives community confidence, and never accepts a client confidence value.
- A recent active incident of the same type within the configured radius is associated using PostGIS `ST_DWithin`; otherwise a new community incident is created.
- Report creation and association run in one transaction. A post-commit `flood-report.created` BullMQ job is emitted for later processing.
- Rapid duplicate submissions from the same user and nearby location are rejected. Association and duplicate thresholds are configured with the `REPORT_*` variables in `.env.example`.

## Media attachments

- `POST /api/v1/media/uploads` authorizes an image upload for a report owned by the signed-in user.
- `POST /api/v1/media/:id/complete` verifies the stored object's content type and byte size through the `StorageProvider`, then marks it available.
- Supported MIME types are `image/jpeg`, `image/png`, and `image/webp`. File extensions are not accepted or used to generate keys.
- Media binary content is kept outside PostgreSQL. The database stores metadata and a server-generated key such as `media/reports/{reportId}/{mediaId}`.
- Public media responses omit uploader IDs and storage keys. Completed media receive expiring read URLs.
- The default `LocalStorageProvider` is an in-memory local/test provider. `S3StorageProvider` supports private S3-compatible stores such as Cloudflare R2 through signed upload and read URLs when `MEDIA_STORAGE_PROVIDER=s3` is configured.

## Incident geospatial conventions

- Coordinates are supplied and returned as `longitude, latitude` in that order.
- Incident points use WGS 84, SRID `4326`, stored as PostGIS `geography(Point, 4326)`.
- Radius distances are meters and use database-native `ST_DWithin`/`ST_Distance` operations.
- Bounding boxes use `west`, `south`, `east`, and `north` longitude/latitude values and use `ST_Intersects` against an SRID `4326` envelope.
- The optional affected geometry is reserved for future polygon support and is stored with SRID `4326`.

Example map queries:

```text
GET /api/v1/incidents?longitude=3.42&latitude=6.43&radiusMeters=5000
GET /api/v1/incidents?west=3.20&south=6.30&east=3.60&north=6.60
```

Flood-report coordinates use the same longitude-first WGS 84 convention. `occurredAt` describes when the user observed the condition; database-created timestamps remain server authoritative.

## Community confirmations

- `POST /api/v1/incidents/:incidentId/confirm` requires a bearer access token.
- Each user has one confirmation record per incident. Repeated requests within the configured cooldown are idempotent; a later reconfirmation refreshes the confirmation timestamp without inflating the unique-user count.
- The incident row is locked during confirmation, inactive or expired incidents are rejected, and confirmation aggregates are recalculated from database rows.
- Confirmation counts and timestamps are never accepted from clients. A post-commit `incident-confirmation.created` BullMQ job is emitted for later confidence, community-impact, and incident-lifetime processing.
- Configure the cooldown with `INCIDENT_CONFIRMATION_COOLDOWN_SECONDS` in `.env.example`.

## Incident confidence and lifecycle

- `IncidentConfidenceService` uses a deterministic, configurable evidence model. Positive signals include unique confirmations, recent reports and confirmations, distinct reporters, available photos, trusted-contributor weighting, and official-source/information weighting. Contradictory evidence, resolution reports, and incident age apply explicit penalties.
- Scores are normalized to `0..1` and labeled `LOW`, `MEDIUM`, or `HIGH` using configured thresholds. Official incidents receive a configured source-confidence baseline before contradiction, resolution, and age penalties. The score expresses confidence in the evidence that an incident exists; it is not a guarantee of physical safety.
- Recalculation is queued after report submission and confirmation. Moderation and official-information integrations can call `IncidentConfidenceService.requestRecalculation()` with an auditable reason and optional domain-event ID; the job is idempotent because it recomputes from database evidence and overwrites only derived fields.
- Community incidents receive an active expiry window when reports are processed, and confirmations extend that window. Official incidents honor explicit `expiresAt` values. A repeatable BullMQ sweep marks due or stale active incidents as `EXPIRED`; the active predicate makes retries safe.
- Current contributor trust, contradictory-report, and resolution-report registries are intentionally not fabricated. Their scoring inputs are present for the moderation/trust domains to populate later.

## Official warnings

- Official warnings are stored separately from community reports in `official_warnings`. `OfficialWarningProvider` adapters return normalized feed items; ingestion does not implicitly create or update canonical incidents.
- Provider identity is `(authority, externalId)`, enforced by a database unique constraint. Re-ingesting unchanged data is idempotent; material updates emit `official-warning.changed`, while cancellation and expiry emit dedicated events.
- `GET /api/v1/official-warnings` supports active/status, issued/effective/updated time, and affected-area radius filters. A PostGIS GiST index and `ST_DWithin` keep affected-area queries database-native.
- Warning expiry is processed by a repeatable BullMQ job. API responses expose safe warning fields, source URLs, GeoJSON affected geometry, status, and `isActive` for UI copy such as authority-specific titles and publication times.

## Saved places

- Saved places are private to their owning user and support `HOME`, `WORK`, `SCHOOL`, `FAMILY`, and `CUSTOM` types.
- `HOME`, `WORK`, and `SCHOOL` are unique per user through a partial database unique index. Family and custom places can repeat; custom places require a label.
- CRUD endpoints are authenticated at `/api/v1/saved-places`. Ownership is applied in every repository query, so unrelated users receive not-found responses rather than another user's data.
- `SavedPlacesService.findPlacesAffectedByIncident()` evaluates active saved places against both an incident point and optional affected geometry with PostGIS `ST_DWithin`; this is the integration point for the future alert engine.

## Alert preferences

- `GET /api/v1/alert-preferences` and `PATCH /api/v1/alert-preferences` manage one default profile per user.
- Radius is stored as an integer number of meters, not a fixed option enum. Product bounds and the default are configured with `ALERT_RADIUS_MIN_METERS`, `ALERT_RADIUS_MAX_METERS`, and `ALERT_DEFAULT_RADIUS_METERS`.
- Supported alert types are severe flooding, moderate flooding, blocked roads, and blocked drains. Severe flooding is always added server-side and is also protected by a database check constraint.
- The persistence model has an optional saved-place scope and partial uniqueness indexes so per-place overrides can be added without changing the default-profile API.

## Local development

1. Copy `.env.example` to `.env`.
2. Start local dependencies:

   ```powershell
   docker compose up -d postgres redis
   ```

3. Install dependencies and generate Prisma Client:

   ```powershell
   npm install
   npm run db:generate
   ```

4. Apply migrations and start the API:

   ```powershell
   npm run db:migrate
   npm run start:dev
   ```

The API listens on `http://localhost:3000`, Swagger on `http://localhost:3000/docs`, and health endpoints under `/api/v1/health`.

Docker is optional. A managed Supabase Postgres database with PostGIS and an Upstash Redis database are supported through `DATABASE_URL` and `REDIS_URL`. When using Supabase's transaction pooler on port `6543`, the application adds Prisma's `pgbouncer=true` and connection-limit settings automatically. Use a session/direct connection for migration operations if the provider requires it.

For the controlled hackathon scenario, see [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md). The repeatable commands are:

```powershell
npm run demo:seed
npm run demo:trigger-hazard
```

`demo:seed` is idempotent, resets the route hazard to expired, clears the controlled route cache, and does not delete user data. `demo:trigger-hazard` activates the stable route hazard and queues navigation/alert evaluation jobs. Seeded incidents are synthetic and must be described as demo data.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

To run the API and dependencies in Docker, build the image first with `npm install` in the backend directory, then run:

```powershell
docker compose --profile full up --build
```

## Environment variables

See `.env.example`. Secrets are intentionally omitted. Production deployments must provide managed PostgreSQL and Redis credentials through the deployment environment or secret manager.

## Vercel deployment

The API can run as a Vercel Function with `JOBS_PROCESSOR_ENABLED=false`. BullMQ processing requires a separate persistent Node.js worker using `npm run worker` with `JOBS_PROCESSOR_ENABLED=true`. Production Mapbox, S3-compatible media, Firebase Cloud Messaging, and Twilio adapters are selectable by environment configuration. See [Vercel deployment and live-service setup](docs/VERCEL.md) for required variables, credential setup, and limitations.

## Notification channels

Notification destinations and preferences are user-owned. The available channels are `APP_PUSH`,
`SMS`, and `WHATSAPP`:

- `GET/PATCH /api/v1/notification-preferences`
- `POST/DELETE /api/v1/devices` and `/api/v1/devices/:id`
- `POST /api/v1/phone/verification/start`
- `POST /api/v1/phone/verification/confirm`
- `POST /api/v1/whatsapp/connection/start`
- `POST /api/v1/whatsapp/connection/confirm`
- `DELETE /api/v1/whatsapp/connection`

Phone numbers must be supplied in E.164 form and are stored only on the messaging destination.
Verification codes are HMAC-hashed, expire, are attempt-limited, and are never returned by the API.
The development adapters log masked destinations; replace the provider bindings in the notifications
module with production adapters without changing domain services.

## Alert evaluation and delivery

Active incidents and official warnings enqueue alert-evaluation jobs. PostgreSQL/PostGIS selects one
closest matching saved place per user per batch, applying the saved-place radius, incident type,
active-state, and verified-channel predicates. Notification dedupe keys are unique in the database;
severity/type trigger keys permit a materially higher severity to escalate once without repeatedly
spamming a user about an unchanged event.

Delivery is asynchronous. Each channel has a `NotificationDelivery` record, BullMQ retries transient
provider failures, and final failures are marked `DEAD_LETTER` for operational inspection. Incident
creation is not blocked by provider delivery.

## Map feed

Use `GET /api/v1/map/incidents?north=...&south=...&east=...&west=...` for a bounded marker feed.
Coordinates are WGS84 longitude/latitude, with longitude first. `updatedSince` supports incremental
refresh and terminal-state changes are returned when they changed after that cursor so clients can
remove stale markers. The response is limited to 500 markers, returns `clustered`, `clusterId`, and
`pointCount` fields for a client-clustering-compatible contract, and does not include descriptions,
reports, or media. `west > east` is treated as an international-date-line crossing; equal west/east
is rejected. The query uses the incident location GiST index and database-side envelope predicates.
The critical query should be checked in each deployment with `EXPLAIN (ANALYZE, BUFFERS)`; the
geography `&&` prefilter is intentional so the GiST index narrows candidates before exact
`ST_Intersects` evaluation.

The feed intentionally does not cache by default: viewport bounds, filters, and incremental cursors
are materially significant cache keys, and correctness is preferred until a bounded Redis cache is
introduced with all of those dimensions included.

## Routing and reported flood risk

`POST /api/v1/routes/preview` accepts an origin, destination, optional waypoints, and one of
`DRIVING`, `TRANSIT`, `CYCLING`, or `WALKING`. Coordinates are WGS84 objects with longitude first;
distances are meters and durations are seconds. The response contains normalized route candidates
and a deterministic risk summary for each candidate. Provider response structures and credentials
are not exposed.

The configured default is `ROUTING_PROVIDER=local`, a development-only straight-line provider that
exists so local development and tests do not require third-party credentials. It is not suitable for
turn-by-turn navigation. A production road-network adapter implements `RoutingProvider` and is
bound through the `ROUTING_PROVIDER` token in `RoutingModule`.

Risk evaluation uses PostGIS to find active, non-expired incidents within the configured
`ROUTE_RISK_CORRIDOR_METERS` corridor around the complete route geometry. It weights severity,
confidence, recency, official-source evidence, and distance from the corridor using a transparent
bounded formula. It reports `Lower reported flood risk`, `Flood reports detected`, or `No currently
known reports`; it never claims a route is absolutely safe. Route previews compare available
alternatives with configurable risk, duration, and distance weights, and return the selected route
plus `recommendationReason` and objective `avoidedIncidentCount` values.

Route previews are cached briefly in Redis using a hash of the complete request, including waypoints
and travel mode. Provider timeout/failure metrics are emitted as structured application logs with
provider name, latency, cache state, and route count. External provider failures are returned as
stable dependency errors rather than leaking vendor response bodies.

Active navigation sessions are private to their owner at `/api/v1/navigation/sessions`. Incident
events enqueue batched PostGIS route-corridor checks; eligible sessions are rerouted only when the
reported risk improvement and duration-overhead policy are met. Session/incident uniqueness,
cooldown, and row locking make repeated events idempotent. Route-update delivery is abstracted so
WebSocket/SSE plus background push can replace the local logging transport later.

## Location search

The normalized location API is provider-neutral:

- `GET /api/v1/locations/search?q=...`
- `GET /api/v1/locations/:providerPlaceId`
- `GET /api/v1/locations/reverse?lat=...&lng=...`

Responses use WGS84 coordinates as `{ longitude, latitude }`, plus a provider place ID,
display name, formatted address, and optional locality metadata. Provider API keys and raw provider
objects are never returned. Search calls are rate-limited and briefly cached in Redis; frontend
debouncing remains a client responsibility. The current local adapter intentionally returns no
external provider data until a production `GeocodingProvider` is bound. Search is not implicitly
biased by user location; any future viewport bias must be explicit in the request contract.

## Community impact and contributor status

`GET /api/v1/me/community-impact` derives metrics from source-of-truth reports, confirmations, and
alert-engine notification records. Rejected reports are excluded, confirmations are counted from
valid confirmation records, and recipients are deduplicated by incident and user. Clients cannot
write or submit these counters.

Authenticated profiles include a server-owned `contributorStatus` of `STANDARD`, `VERIFIED`, or
`SUSPENDED`. Status changes require an administrator configured through
`CONTRIBUTOR_ADMIN_USER_IDS` and are recorded in `contributor_status_audits`; users cannot promote
themselves. Verified-contributor weighting is exposed to the confidence engine through a provider
interface and remains controlled by backend scoring rules.

## In-app alert history

The alert engine creates the in-app records returned by:

- `GET /api/v1/alerts`
- `GET /api/v1/alerts/:id`
- `POST /api/v1/alerts/:id/read`
- `POST /api/v1/alerts/read-all`

Alert history is private to the authenticated user, paginated, and supports `unread`, `severity`,
and `category` filters. Reading is idempotent. External delivery state is deliberately separate
from `readAt`, so an in-app alert remains available even when SMS, WhatsApp, or push delivery fails.

## Security and operations

Security boundaries, abuse controls, deployment assumptions, and residual risks are documented in
[`SECURITY.md`](./SECURITY.md). Operational dashboards, alerts, triage runbooks, and release checks
are in [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). The protected operational metrics endpoint is
`GET /api/v1/metrics`; set `METRICS_ACCESS_TOKEN` in production and keep Swagger access-controlled
or disabled there.

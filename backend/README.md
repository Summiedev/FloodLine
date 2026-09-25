# FloodLine backend

This repository contains the production backend foundation for FloodLine. Authentication, basic user accounts, canonical flood-incident map queries, and authenticated community flood-report submission are implemented; alerting, routing, and community-impact workflows remain isolated module boundaries for subsequent work.

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
- The default `LocalStorageProvider` is an in-memory local/test provider. An S3-compatible implementation can be added behind the same provider interface before setting `MEDIA_STORAGE_PROVIDER=s3`.

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

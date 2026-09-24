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

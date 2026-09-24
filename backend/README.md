# FloodLine backend

This repository contains the production backend foundation for FloodLine. Authentication and basic user accounts are implemented; flood, alerting, routing, and community-reporting domains remain isolated module boundaries for subsequent work.

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

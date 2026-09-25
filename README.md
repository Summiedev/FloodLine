# FloodLine

FloodLine is a flood-awareness, community-reporting, alerting, and safer-routing platform. The repository currently contains the backend foundation, authentication/user-account infrastructure, canonical flood incidents, and community flood-report submission. Saved places, alerts, notifications, and routing remain reserved for later feature work.

## Repository layout

```text
.
├── backend/       NestJS API, Prisma schema/migrations, tests, and Docker setup
├── .gitignore     Repository-wide generated-file and secret exclusions
└── README.md      Project overview and developer onboarding
```

Backend-specific architecture and implementation notes are in [`backend/README.md`](backend/README.md).

## Current backend capabilities

- TypeScript and NestJS API
- PostgreSQL with PostGIS through Prisma
- Redis and BullMQ infrastructure
- Versioned API under `/api/v1`
- Environment validation, structured logging, request IDs, validation, error handling, CORS, and rate limiting
- Liveness and dependency readiness checks
- Swagger documentation at `/docs`
- Email/password authentication with Argon2id password hashing
- JWT access tokens with rotating, revocable refresh sessions
- User registration, login, logout, current-user, and basic display-name update endpoints
- Authentication audit logging
- Canonical flood-incident map queries with PostGIS radius and bounding-box filtering
- Authenticated community flood-report submission with transactional incident association
- Post-commit BullMQ job emission for newly created community reports
- Authenticated community incident confirmations with cooldown and transaction-safe aggregates
- Secure image media authorization and completion with provider abstraction
- Safe available-report-photo summaries on incident detail responses

## Planned domain boundaries

The backend includes module boundaries for the following future domains:

- official warnings
- saved places
- alert preferences
- notifications
- routing and navigation
- geocoding
- community impact
- external integrations
- background jobs

These modules are intentionally not implemented until their individual requirements are defined.

## Local development

Prerequisites:

- Node.js 20 or newer
- Docker Desktop with Docker Compose

From the repository root:

```powershell
Set-Location backend
Copy-Item .env.example .env
npm install
npm run db:generate
docker compose up -d postgres redis
npm run db:migrate
npm run start:dev
```

The API runs at `http://localhost:3000`.

Useful URLs:

- Liveness: `http://localhost:3000/api/v1/health`
- Readiness: `http://localhost:3000/api/v1/health/ready`
- Swagger: `http://localhost:3000/docs`

The copied `.env` contains development-only values. Never commit it or place production credentials in `.env.example`.

## Verification commands

Run these from `backend/`:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

To run the API and dependencies fully in Docker:

```powershell
docker compose --profile full up --build
```

## Database changes

Database changes must be represented by committed Prisma migrations. The current migrations enable PostGIS and create the authentication/user-account, canonical incident, community flood-report, media metadata, and incident-confirmation tables. Apply migrations locally with:

```powershell
npm run db:migrate
```

Do not edit an already-applied migration. Create a new migration for subsequent schema changes.

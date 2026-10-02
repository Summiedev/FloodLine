# Production deployment

This repository uses two deployments:

- Frontend: Vercel project with root directory `frontend`
- Backend: Vercel project with root directory `backend`
- Worker: a persistent Node host running the backend worker command

Do not commit real secrets. Add these values in the hosting provider's
**Production** environment settings.

## Frontend variables

```env
VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN.vercel.app/api/v1
VITE_MAPBOX_ACCESS_TOKEN=pk.your_public_mapbox_token
VITE_DEMO_MODE=false
VITE_DEMO_NAVIGATION_SECONDS=1800
```

The frontend build command is `npm run build` and its output directory is
`dist`. Vite embeds `VITE_*` values during the build, so redeploy after
changing them.

## Backend variables

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
REDIS_PREFIX=<unique-deployment-prefix>
CORS_ORIGINS=https://YOUR-FRONTEND-DOMAIN.vercel.app
JWT_ACCESS_SECRET=at-least-32-random-characters
NOTIFICATION_VERIFICATION_SECRET=at-least-32-different-random-characters
NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY=at-least-32-different-random-characters
METRICS_ACCESS_TOKEN=at-least-32-random-characters
JOBS_PROCESSOR_ENABLED=false
```

The backend build command is `npm run vercel-build`. The Vercel API must use
`JOBS_PROCESSOR_ENABLED=false`; Vercel Functions are not a persistent queue
worker.

For live routing and geocoding, also set:

```env
ROUTING_PROVIDER=mapbox
GEOCODING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=sk.your_server_mapbox_token
MAPBOX_GEOCODING_COUNTRY=ng
MAPBOX_GEOCODING_PERMANENT=true
```

For production report-photo storage, configure private S3-compatible storage:

```env
MEDIA_STORAGE_PROVIDER=s3
S3_ENDPOINT=<s3-compatible-endpoint>
S3_REGION=<provider-region>
S3_BUCKET=<private-bucket-name>
S3_ACCESS_KEY_ID=<runtime-value>
S3_SECRET_ACCESS_KEY=<runtime-value>
```

If Firebase or Twilio providers are enabled, add their credentials from
`backend/.env.example` as well. Otherwise leave the providers set to `local`.

## Worker variables

Deploy the same backend source to a persistent Node service with the backend
variables above and set:

```env
JOBS_PROCESSOR_ENABLED=true
```

Start it with:

```text
npm run worker
```

Generate random secrets locally with:

```powershell
node -e "const c=require('crypto'); for (const n of ['JWT_ACCESS_SECRET','NOTIFICATION_VERIFICATION_SECRET','NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY','METRICS_ACCESS_TOKEN']) console.log(n+'='+c.randomBytes(32).toString('base64url'))"
```

Run the database migrations once against the production database before
opening the API:

```powershell
Set-Location backend
npm run db:migrate
```

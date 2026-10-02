# Vercel deployment and live-service setup

FloodLine's HTTP API can run on Vercel. It requires external PostgreSQL with
PostGIS, a TCP-compatible Redis service, and a separately deployed queue
worker. Set the Vercel project's **Root Directory** to `backend`.

## Add these Vercel environment variables

Set these in **Project → Settings → Environment Variables**, for the
Production environment. Never commit any of them to Git.

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
REDIS_PREFIX=<unique-deployment-prefix>
JWT_ACCESS_SECRET=<random 32+ character value>
NOTIFICATION_VERIFICATION_SECRET=<different random 32+ character value>
NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY=<different random 32+ character value>
METRICS_ACCESS_TOKEN=<different random 32+ character value>
CORS_ORIGINS=https://your-frontend.vercel.app
JOBS_PROCESSOR_ENABLED=false

ROUTING_PROVIDER=mapbox
GEOCODING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=sk...
MAPBOX_GEOCODING_COUNTRY=ng
MAPBOX_GEOCODING_PERMANENT=true

MEDIA_STORAGE_PROVIDER=s3
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=floodline-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

PUSH_NOTIFICATION_PROVIDER=fcm
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

SMS_NOTIFICATION_PROVIDER=twilio
WHATSAPP_NOTIFICATION_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
TWILIO_SMS_FROM=+...
TWILIO_WHATSAPP_FROM=whatsapp:+...
```

Generate the four random FloodLine secrets locally:

```powershell
node -e "const c=require('crypto'); for (const n of ['JWT_ACCESS_SECRET','NOTIFICATION_VERIFICATION_SECRET','NOTIFICATION_DEVICE_TOKEN_ENCRYPTION_KEY','METRICS_ACCESS_TOKEN']) console.log(n+'='+c.randomBytes(32).toString('base64url'))"
```

## Database migration

Create a hosted PostgreSQL database where `CREATE EXTENSION postgis` is
permitted, then run this once for each reviewed deployment:

```powershell
cd backend
$env:DATABASE_URL = 'paste-the-hosted-database-URL-here'
npm run db:migrate
```

Do not execute database migrations in every Vercel function boot.

## Queue worker

BullMQ jobs process confidence updates, expiry sweeps, alert evaluation, and
notification delivery. Vercel Functions are request-driven and cannot be the
only queue worker. Deploy the same `backend` repository to a persistent Node.js
host for the worker and configure the same database, Redis, provider, and
secret values there, plus:

```env
JOBS_PROCESSOR_ENABLED=true
```

Its start command is:

```text
npm run worker
```

## Provider credentials

### Mapbox: live routing and location search

1. Create a Mapbox account and open its access-token page.
2. Create a **secret** token for this backend and enable only the Directions
   and Geocoding scopes it needs.
3. Put that token in `MAPBOX_ACCESS_TOKEN` on Vercel. Do not use it in a web
   browser or mobile application.
4. For a future map UI, create a second **public** token, restrict it to your
   frontend domains, and keep it in the frontend deployment only.

The backend uses Directions v5 with alternatives enabled and Geocoding v6.
Mapbox's Geocoding terms distinguish temporary from permanently stored results;
FloodLine saves selected place/address details, so configure the appropriate
Mapbox plan and storage entitlement before launch.

### Cloudflare R2: report photos

1. Create an R2 bucket named `floodline-media`.
2. Keep the bucket private.
3. Create an R2 S3 API token limited to **Object Read & Write** on that bucket.
4. Copy the endpoint, Access Key ID, and Secret Access Key into the `S3_*`
   variables above.

FloodLine uses server-owned object keys and expiring upload/read URLs.

### Firebase Cloud Messaging: push notifications

1. Create a Firebase project.
2. Enable Cloud Messaging.
3. Create a service account for the server and create a private key.
4. Copy its project ID, client email, and private key into the `FIREBASE_*`
   variables.

The mobile or web client must still register an FCM device token through the
FloodLine device endpoint before it can receive a push notification.

### Twilio: SMS and WhatsApp testing

1. Create a Twilio trial account and verify your own phone number.
2. Copy the Account SID.
3. Create a restricted API key with permission to send Messages; copy its SID
   and secret.
4. For SMS, obtain or use the trial sender number and set `TWILIO_SMS_FROM`.
5. For WhatsApp testing, activate Twilio's WhatsApp trial/Sandbox, join it from
   your WhatsApp account, and set `TWILIO_WHATSAPP_FROM` to the displayed
   `whatsapp:+...` sender.

Twilio trials only send to verified test recipients and have template/content
limits. They are suitable for a proof of concept, not public flood alerts.

## Explicit non-keys

- `DATABASE_URL` and `REDIS_URL` are connection credentials, not API keys.
- An official-warning provider is intentionally not enabled by an arbitrary
  public URL. A live authority feed needs a named authority, written permission
  or published terms, and a feed-specific parser before it can be trusted.
- This repository contains backend APIs, not a browser/mobile map UI. A frontend
  must render the map and use a restricted public Mapbox token.

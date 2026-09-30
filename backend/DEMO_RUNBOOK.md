# FloodLine hackathon demo runbook

This is a controlled demo scenario, not a claim that these incidents are live. The seed records are clearly marked `Demo` in their location and description.

## Start the stack

Use three terminals:

```powershell
# Terminal 1: API
cd C:\Users\USER\Desktop\Projects\Floodline\backend
npm run start:dev

# Terminal 2: queue worker
cd C:\Users\USER\Desktop\Projects\Floodline\backend
npm run worker

# Terminal 3: frontend
cd C:\Users\USER\Desktop\Projects\Floodline\frontend
npm run dev -- --host 127.0.0.1
```

For the recording, use the local notification adapters. They log/capture delivery and never call WhatsApp, SMS, or FCM:

```powershell
$env:PUSH_NOTIFICATION_PROVIDER = 'local'
$env:SMS_NOTIFICATION_PROVIDER = 'local'
$env:WHATSAPP_NOTIFICATION_PROVIDER = 'local'
```

Set these before starting the API/worker if the `.env` file selects a real provider.

## Reset the controlled dataset

Run this after migrations and before recording:

```powershell
cd C:\Users\USER\Desktop\Projects\Floodline\backend
npm run demo:seed
```

This creates three active Lagos incidents, one active controlled official warning, and resets the route hazard to `EXPIRED`. It is idempotent and does not delete user data. The warning and incidents are demo records, not live authority data.

The route scenario uses:

- Origin: `3.3792, 6.5244` (longitude, latitude)
- Destination: `3.4219, 6.4281` (longitude, latitude)
- Travel mode: `DRIVING`

The first route is normally faster. The second route is normally a little longer. The dormant hazard point is placed on the faster route only.

## Recording sequence

For a polished video, record two short takes and edit them together. This avoids asking one screen to show both the clean baseline and a newly introduced hazard.

### Take A: route comparison

1. Run `npm run demo:seed`.
2. Open the map and show the controlled `Demo` Lagos incident markers.
3. Open Route and click `Use controlled Lagos demo trip`.
4. Before clicking `Show routes`, activate the route hazard:

   ```powershell
   npm run demo:trigger-hazard
   ```

5. Click `Show routes`. The faster route should show an active report while the alternative should show lower reported flood risk.

### Take B: active-navigation update

1. Run `npm run demo:seed` again to reset the hazard.
2. Open the controlled Lagos demo trip and show routes while the baseline is clean.
3. Start navigation on the faster route. Authentication is required because navigation sessions are user-owned.
4. In a separate terminal, activate the new route hazard:

   ```powershell
   cd C:\Users\USER\Desktop\Projects\Floodline\backend
   npm run demo:trigger-hazard
   ```

5. Keep the active-navigation screen open. The worker evaluates the route asynchronously, finds the hazard with PostGIS, requests alternatives, and creates a route update when the lower reported-risk alternative meets the configured duration policy.
6. The active screen runs a clearly labeled `Demo GPS simulation` when the frontend has `VITE_DEMO_MODE=true`. The blue vehicle marker moves slowly along the real route geometry and the displayed ETA counts down from the provider's route duration. The default simulation duration is 1800 seconds; adjust `VITE_DEMO_NAVIGATION_SECONDS` if needed. This is presentation-only; production mode uses browser/device GPS instead.
7. Wait for the active screen to refresh. It should show `Route updated` and the lower reported-flood-risk message.
8. Open Alerts to show the clearly labeled `Notification simulator`. Its previews are presentation-only and say that no external provider was called.

## What is real in this demo

- Map rendering uses Mapbox in the browser.
- Route candidates come from the configured routing provider.
- Flood risk uses the backend PostGIS corridor query.
- Navigation impact evaluation runs through Redis/BullMQ and the worker.
- The map also includes a controlled official warning covering the demo area so judges can see community reports and authority warnings together.
- In demo mode, the moving marker and ETA are synthetic UI behavior driven by the real route geometry; no fake GPS coordinates are sent to the backend.
- Reroute cooldown, deduplication, ownership, and duration policy remain active.
- Notification previews are explicitly simulated; they are not WhatsApp, SMS, or push delivery.

Do not describe the seeded records as live authority data, and do not describe any route as guaranteed safe. Use `lower reported flood risk` and `no currently known reports`.

# FloodLine Operations Runbook

## Runtime signals

The API emits JSON logs with UTC timestamps, context, request IDs, queue correlation IDs, status classes, and durations. It does not intentionally log passwords, tokens, OTPs, provider credentials, signed URLs, query strings, or precise location payloads.

HTTP throttling uses Redis atomically, so limits are shared across API instances. Configure the reverse
proxy's trusted client-IP behavior before relying on IP-based limits.

- `error`: failed dependencies, provider failures, job failures, and unhandled 5xx conditions; page when sustained or correlated with user impact.
- `warn`: rejected/unknown jobs, cache failures, degraded optional integrations, and recoverable delivery failures.
- `log`: lifecycle events and successful operational summaries without personal payloads.
- `debug`/`verbose`: development diagnostics only; do not enable broadly in production.

The API supports `/api/v1/metrics`. Protect it in production with network policy or `METRICS_ACCESS_TOKEN`. The in-process registry is intentionally small and should be replaced or scraped by the deployment's metrics system as scale requires.

## Recommended dashboards and alerts

Create dashboards split by environment and deployment version. Use rates and latency percentiles rather than raw high-cardinality IDs.

- HTTP 5xx rate, 4xx/429 rate, request latency, and saturation by method/status class.
- `dependency_up` and `dependency_latency_ms` for PostgreSQL and Redis.
- `queue_system_waiting`, `queue_system_active`, `queue_system_delayed`, `queue_system_failed` and queue job started/completed/failed counters.
- Routing and geocoding provider request result rates and latency by provider/operation.
- Notification delivery sent/skipped/failed/dead-letter counts and provider latency by channel.
- Alert evaluation runs, evaluated targets, created alerts, and deduplicated alerts.
- Incident and community-report creation/update rates; official-warning change and expiration rates.

Suggested alerts:

- elevated API 5xx or latency for five minutes;
- PostgreSQL or Redis readiness down, or dependency latency above the service objective;
- queue backlog or failed jobs growing for ten minutes;
- notification dead letters or SMS/WhatsApp failures above the normal provider baseline;
- routing/geocoding provider timeouts or failures above baseline;
- official-warning ingestion/expiration sweeps not changing state within the configured operating window;
- unusual report-submission, confirmation, OTP-initiation, or device-registration spikes;
- sustained map/routing query latency indicating geospatial or provider saturation.

## Triage procedures

### API or dependency degradation

1. Check readiness and dependency metrics, then correlate affected requests by request ID.
2. Confirm database connection saturation, slow PostGIS queries, Redis memory/latency, and recent deployment changes.
3. Reduce optional provider traffic or temporarily disable the affected adapter through deployment configuration if necessary. Do not suppress incident persistence to hide errors.
4. Restore capacity, verify health/readiness, then replay only idempotent failed jobs.

### Queue backlog or failed jobs

1. Inspect job name, failure count, correlation ID, and the dead-letter/failure view without copying payload secrets.
2. Determine whether the failure is transient provider capacity, malformed data, or a code regression.
3. Pause or rate-limit the affected provider if retries could amplify cost or spam. Correct the cause before replaying.
4. Reconcile notifications, confidence, lifecycle, warning, and navigation state from source-of-truth tables; job handlers are designed to be replayable.

### Notification provider incident

1. Compare channel-specific sent, skipped, failed, and dead-letter metrics.
2. Check provider status and credentials through the secret manager, not logs.
3. Keep in-app alert records intact; disable only the failing channel if necessary and allow retry backoff to work.
4. Monitor for duplicate sends after recovery and review provider spend/quotas.

### Geospatial performance

1. Check map/incident/risk query latency and database CPU/IO.
2. Confirm GiST indexes are present and inspect query plans with `EXPLAIN (ANALYZE, BUFFERS)` in a safe environment.
3. Verify bounds, radius, page, route-corridor, and map-result limits are being enforced.
4. Use short-lived cache only for materially identical query keys; never broaden a cached geospatial result to a different viewport.

## Release checklist

- Validate environment variables and secret-manager references.
- Apply reviewed Prisma migrations and verify PostGIS.
- Run lint, typecheck, unit tests, e2e tests, build, and migration validation.
- Verify readiness, metrics access control, Swagger exposure policy, CORS allowlist, proxy IP configuration, and graceful shutdown.
- Confirm database backups and object-storage lifecycle rules.
- Record deployment version and rollback target. After release, watch 5xx, readiness, queues, provider failures, report spikes, and alert delivery.

OpenTelemetry is not currently installed. Request and queue correlation hooks are present so an OpenTelemetry SDK/exporter can be added at the HTTP, queue, and provider boundaries without changing domain contracts.

# FloodLine Security

This document describes the security boundary and current abuse resistance of the FloodLine backend. It is an engineering baseline, not a certification or a claim that the application is fully secure. Deployments must still be reviewed against their infrastructure, provider contracts, threat model, and applicable privacy obligations.

## Trust boundaries

- Public HTTP clients are untrusted. Request bodies, query parameters, headers, coordinates, URLs, descriptions, media metadata, device tokens, and provider place IDs are treated as attacker-controlled.
- Authentication tokens cross the client/API boundary. Access tokens are short lived; refresh tokens are rotated and stored only as hashes. Session revocation is checked at the authorization boundary.
- PostgreSQL/PostGIS is a trusted application dependency but contains sensitive account, location, report, media metadata, notification, and audit data. SQL is issued through Prisma parameters or fixed SQL fragments; user values are never interpolated into SQL identifiers or clauses.
- Redis/BullMQ is an internal infrastructure boundary. Jobs are validated at the worker boundary, carry correlation IDs, and must be treated as replayable and potentially malformed. Queue access must not be exposed to public networks.
- Object storage is a separate provider boundary. PostgreSQL stores media metadata, not image bytes. Upload keys are server-generated, signed URLs expire, and completion re-checks object metadata.
- Routing, geocoding, notification, storage, and official-warning providers are replaceable integration boundaries. Provider payloads are normalized and bounded before entering domain logic. Current local adapters do not make outbound network requests.
- Contributor-status administration and deployment configuration are privileged boundaries. Administrative changes are authorization-protected and audited.

## Sensitive data

The following must not be written to application logs or returned through public DTOs:

- passwords, password hashes, access tokens, refresh tokens, OTPs, verification hashes, encryption keys, provider credentials, and signed storage URLs outside their intended response;
- push-device tokens (encrypted at rest), phone numbers beyond the masked verification response, and unnecessary identity data;
- precise saved-place coordinates or route geometry in logs;
- raw provider payloads unless explicitly required for operational reconciliation.

Descriptions and location labels remain user-generated content. Storage does not make them safe HTML; clients must contextually escape them on display. Control characters are rejected at service boundaries to reduce log and parser abuse.

## Current controls

- Global DTO validation uses whitelist and forbids unknown fields. Public collection queries have bounded pagination. Coordinates use WGS84 longitude-first conventions and explicit latitude/longitude ranges.
- Account endpoints and high-cost map, geospatial, routing, geocoding, report, verification, and device operations have route-level throttles backed by an atomic Redis counter/block window. Correct client-IP handling still depends on the reverse-proxy configuration.
- Email identities are normalized. Passwords use the configured password-hashing service. Access tokens carry a session ID and are rejected when the session is revoked or expired.
- Confirmation uniqueness/cooldown, report duplicate windows, server timestamps, database transactions, and queue idempotency reduce replay and manipulation. Clients cannot set confidence, counts, risk, community impact, or delivery outcomes.
- Media accepts a small allowlist of image MIME types, byte limits, server-generated keys, ownership checks, object metadata verification, per-report attachment limits, and encrypted push-token storage.
- Official-warning geometry is validated for type, coordinates, nesting depth, coordinate count, serialized size, and HTTP(S)-only source URLs. The backend does not fetch source URLs, so a source URL is not an SSRF fetch primitive.
- Errors returned for 5xx responses are generic. Structured logs redact credential-shaped fields and request logging excludes query strings. Correlation IDs are available for investigation without making them authorization credentials.
- Metrics use only bounded, low-cardinality labels. The metrics endpoint must be protected in production.

## Abuse cases and response

| Abuse case                                                              | Current mitigation                                                                                                              | Residual risk                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Credential stuffing or account creation bursts                          | Route throttles, password hashing, generic invalid-credential response, audit records                                           | Distributed attacks require a shared Redis/proxy limiter, bot controls, and account recovery policy                 |
| IDOR against users, devices, media, saved places, alerts, or navigation | Auth guard plus owner-scoped repository queries and service checks                                                              | Every future endpoint must preserve owner scoping; privileged/admin review remains necessary                        |
| Report spam                                                             | Authenticated endpoint, IP throttle, per-user/location duplicate window, transaction lock                                       | Attackers can use many accounts/addresses; moderation, reputation, and broader quotas are still needed              |
| Confirmation manipulation                                               | Active-status check, unique incident/user identity, cooldown, row locking, server-side aggregate                                | A coordinated group can still submit valid confirmations; anomaly detection is not implemented                      |
| OTP brute force                                                         | Six-digit code, HMAC hash, expiry, transaction-locked attempt counter, maximum attempts, initiation cooldown, endpoint throttle | SMS/WhatsApp provider abuse and account takeover recovery need provider-level controls and monitoring               |
| Notification spam                                                       | Source/user/place/channel deduplication, escalation-only repeats, asynchronous delivery                                         | Policy limits across distinct incidents and provider spend budgets need product-specific tuning                     |
| Media storage exhaustion                                                | MIME/size validation, signed uploads, per-report cap, bounded incident photo reads                                              | Object-storage lifecycle cleanup and malware/content scanning are deployment responsibilities                       |
| Geospatial denial of service                                            | Bounded pages, map result limits, radius limits, GiST-backed PostGIS queries, route geometry bounds, provider timeouts          | Very broad/global map requests and high concurrency still require capacity limits, caching, and database monitoring |
| SQL injection                                                           | Prisma parameters and fixed SQL fragments; no dynamic identifiers from clients                                                  | Raw SQL additions must receive security review and parameterization tests                                           |
| SSRF                                                                    | Current source URLs are stored/displayed but not fetched; local providers make no outbound calls                                | Any future provider/webhook adapter needs egress allowlists, DNS/IP protections, timeouts, and response-size limits |
| Queue poisoning/replay                                                  | Internal Redis, validated UUID payloads, idempotent persistence keys, retry/dead-letter visibility                              | Operators must restrict queue access and inspect repeated failures                                                  |
| Malicious provider payloads                                             | Normalization, schema/size/geometry validation, provider timeouts and stable errors                                             | External adapters are not implemented yet and must not bypass these boundaries                                      |

## Flood-report flow

1. An authenticated user submits a validated report. The server supplies timestamps and ignores any client confidence or aggregate values.
2. The report transaction obtains a submission lock, rejects a recent duplicate, associates to a compatible active incident or creates one, and persists both consistently.
3. A validated internal job triggers confidence/lifecycle, alert, and navigation evaluation asynchronously. Provider failures do not roll back the accepted report.
4. Media uploads use pending metadata and direct signed storage upload. Completion checks ownership, object type, size, and metadata before making a photo available.
5. Moderation and audit workflows remain authoritative for rejection, contributor status, and later corrections.

## Security incident reporting flow

For a suspected security incident:

1. Preserve the UTC timestamp, deployment/version, affected route or job, and request/job correlation ID. Do not copy secrets, tokens, OTPs, or precise user locations into the ticket.
2. Triage scope: revoke affected sessions/devices, disable or rotate exposed provider credentials, pause affected queues/providers, and restrict metrics/administrative access as needed.
3. Preserve relevant audit records, redacted logs, queue failure data, and database/object-storage evidence under the organization's retention policy.
4. Assess affected accounts, reports, media, locations, notifications, and provider spend. Follow the organization's legal, privacy, and user-notification obligations.
5. Remediate, rotate secrets, add a regression test, update this document/runbook, and record residual risk before restoring normal traffic.

## Deployment assumptions

- TLS terminates at a trusted reverse proxy; the proxy is configured correctly for client IP extraction before IP-based throttles are relied upon.
- PostgreSQL/PostGIS, Redis, BullMQ, and object storage are private network dependencies with authentication, encryption in transit, backups, and least-privilege credentials.
- Production uses a unique random JWT secret, notification verification secret, device-token encryption key, provider credentials, and metrics access token. Development values in `.env.example` are not production secrets.
- Existing device registrations must be re-enrolled or migrated through a reviewed one-time process when enabling encrypted push-token storage; the application deliberately rejects legacy plaintext token rows rather than returning them to providers.
- Database migrations run from a reviewed release artifact with backups and a rollback/reconciliation plan. Redis queues survive worker restarts and failed jobs are monitored.
- Object storage buckets are private, signed URLs are short lived, and unfinished uploads have lifecycle cleanup. Media malware scanning is required before public trust is attached to uploaded content.
- `/api/v1/metrics` is private or protected by a sufficiently random `METRICS_ACCESS_TOKEN`. Swagger should be disabled or access-controlled in production.
- Future outbound adapters use explicit provider allowlists, request timeouts, maximum response sizes, payload schemas, and safe webhook signature verification. No webhook endpoint is currently implemented.
- Run a dependency, secret, migration, backup-restore, load, and penetration review before production launch.

## Residual risks

The backend still needs production-scale throttling/load validation, account recovery/phone ownership policy, moderation and reputation tooling, object-storage malware scanning, provider-specific webhook/signature implementations, outbound egress controls for future adapters, load testing of PostGIS/map feeds, and formal privacy/retention decisions for precise location and media data. These are known open risks, not accepted evidence that the system is fully secure.

# ShieldAI

[![CI](https://github.com/1o1swapnil/ShieldAI/actions/workflows/ci.yml/badge.svg)](https://github.com/1o1swapnil/ShieldAI/actions/workflows/ci.yml)

Shadow AI governance platform. Implements the v1.1 design addendum:

- **Section 1** — honest coverage-map reframing, native-app egress detection, SSO OAuth-grant discovery
- **Section 2** — unknown AI tool classifier (feature extraction + review queue)
- **Section 3** — extension permission narrowing, trust/security summary, signed build verification
- **Section 4** — employee monitoring notice/consent, jurisdiction-gated feature toggles

Also includes v1.0 base pieces the addendum assumed already existed:
- the activity-events ingestion pipeline (Section 8) that the extension's content script feeds and the classifier's aggregate-usage signal now reads from
- the real AI tool library (Section 12): 150+ seeded tools across 15 categories, replacing the `ai_tools` stub
- real authentication + SSO (Sections 6-7): password login, JWT sessions, a generic OIDC connector (Okta/Azure AD/any compliant IdP), and org/role authorization on every admin-dashboard route — replacing the "trust whatever org_id the client sends" model every earlier endpoint used
- device-token auth (Section 7) for the extension's own ingestion calls: an admin-issued install token exchanges once for a long-lived, individually revocable device token, closing the last "trust whatever org_id/user_id the client sends" gap
- CORS, and email verification before an account or a device gets a working credential — closes the "type any email, get attributed to it" identity gap
- Rate limiting on `/auth/login` (per-IP and per-email) and `/auth/register` (per-IP) — closes the open brute-force/credential-stuffing gap
- Revocation for user-session JWTs, mirroring the device-token model: a `sessions` row per login, checked live on every request, so a leaked/compromised session can be killed immediately instead of surviving its full 24h expiry
- A real SMTP provider behind the verification mailer (`nodemailer`), replacing the console-log-only stub

## Structure

```
server/     Express + Postgres API
web/        Vite + React admin/employee dashboard
extension/  Manifest V3 browser extension
```

## Prerequisites

- Node.js 18+
- PostgreSQL (any recent version)

## Server

```
cd server
npm install
cp .env.example .env   # set DATABASE_URL to your Postgres instance
```

Create the database, then apply migrations in order:

```
createdb shieldai
psql -d shieldai -f migrations/0001_base.sql
psql -d shieldai -f migrations/0002_consent.sql
psql -d shieldai -f migrations/0003_extension_trust.sql
psql -d shieldai -f migrations/0004_unverified_tools.sql
psql -d shieldai -f migrations/0005_coverage.sql
psql -d shieldai -f migrations/0006_activity_events.sql
psql -d shieldai -f migrations/0007_ai_tools_library.sql
psql -d shieldai -f migrations/0008_auth.sql
psql -d shieldai -f migrations/0009_device_auth.sql
psql -d shieldai -f migrations/0010_email_verification.sql
psql -d shieldai -f migrations/0011_session_revocation.sql
psql -d shieldai -f migrations/0012_case_insensitive_email.sql
psql -d shieldai -f migrations/0013_users_org_id_not_null.sql
psql -d shieldai -f migrations/0014_audit_log.sql
```

(Or just use `node scripts/migrate.js` — see Deployment below — it applies whatever's new in `migrations/` in order and tracks what's already run, so it doesn't go stale like this manual list.)

Seed the AI tool library (idempotent — safe to re-run after the seed list grows):

```
DATABASE_URL=... node seeds/seed-ai-tools.js
```

Run tests and start the server:

```
npm test
npm start   # listens on PORT (default 3000)
```

Set `JWT_SECRET` in production (an ephemeral one is generated per-process otherwise — fine for local dev, invalidates sessions on every restart). For SSO, set `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` (any standards-compliant OIDC provider — Okta, Azure AD, etc.) and `WEB_ORIGIN` (used for both the SSO callback redirect and CORS — set it to the web app's real origin; comma-separate for multiple).

`/auth/login`, `/auth/register`, `/auth/forgot-password`, and `POST /org/:orgId/invites` are rate-limited by `req.ip` (per-IP; login also by email, invites by the inviting admin's user id). Behind a real reverse proxy/load balancer, call `app.set('trust proxy', ...)` in `src/index.js` with the correct hop count — otherwise every client behind the proxy shares Express's default IP (the proxy's own address) and the per-IP limiter becomes either useless or a shared bucket for everyone.

`server/src/rateLimit.js` is an in-memory fixed-window limiter by default — single-process only, so a load balancer fanning out to multiple server replicas would give each replica its own independent quota. Set `REDIS_URL` (e.g. `redis://host:6379`) to share the counters across every replica via Redis (`INCR`+`PEXPIRE` per window) instead — same limiter call sites, no code changes needed elsewhere. Fails open on a Redis error (allows the request through, logging the error) rather than taking registration/login/invites down entirely during a Redis outage. Not wired into `docker-compose.yml`, which only ever runs one server replica — add a `redis` service and set `REDIS_URL` yourself if you scale to multiple replicas.

Password reset (`POST /auth/forgot-password` → `POST /auth/reset-password`): the forgot-password response is always
identical regardless of whether the email exists or even uses password auth (SSO/device accounts have no password) —
it never leaks which emails are registered. The reset ticket is single-use: it's bound to a fingerprint of the
current password hash, so a replayed link (e.g. dug out of an old email) is rejected once the password has actually
changed. Resetting revokes every other active session for that account and logs the user in immediately with a
fresh one, same "click IS the login" pattern as email verification.

Email (`src/email.js`, via `nodemailer`): unset `SMTP_HOST` (the default) logs the verification link to stdout instead of sending — no real mailbox needed for local dev/tests. Set `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `SMTP_SECURE=true` if your provider uses implicit TLS (port 465) rather than STARTTLS, to send for real — works with any standard SMTP provider (SES, SendGrid, Postmark, etc.). Registration is transactional: if the email fails to send, the org/user (or device) rows roll back entirely instead of leaving a stuck half-registered account behind.

`0001_base.sql`'s `organizations`/`users` stub has since grown real auth columns (0008).

Admin invites (`POST /org/:orgId/invites` → `POST /auth/accept-invite`): an admin invites a teammate by email +
role; there's no invites table, the ticket itself is stateless (same pattern as email verification/password reset)
and carries `org_id`/`email`/`role`, so `users.email` uniqueness on both ends is what makes it single-use. Clicking
the link and setting a password creates the account already email-verified (the click is the proof) and logs
straight in — same "click IS the login" pattern as verify-email/reset-password. There's no server-side list of
invites sent but not yet accepted as a result — a real invites table is the upgrade path if that visibility turns
out to matter.

Deploying 0011 forces everyone to re-authenticate: existing tokens have no `sid` claim to match a `sessions` row against, so `requireAuth` correctly treats them as revoked. Unlike 0010's backfill, there's nothing to grandfather here — sessions didn't exist before this migration.

## Web

```
cd web
npm install
npm run dev     # dev server
npm run build   # production build to dist/
```

Set `VITE_API_BASE` (defaults to `http://localhost:3000`) if the API isn't running locally.

Register an org (or log in) on first load; the org id comes from your session — no more pasting one in manually.

## Extension

Load `extension/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked).

An admin creates an install token from the Devices tab (or `POST /org/:orgId/install-tokens`), and shares a link like
`chrome-extension://<extension-id>/notice.html?install_token=<token>` with employees. Opening it exchanges the
token for a long-lived device token (`POST /extension/register-device`) that the extension then uses for every
device-facing call. Revoke a device from the same tab to cut it off immediately, independent of the token's own
expiry.

The API base URL lives in `extension/config.json` (`{"apiBase": "..."}`), not a source literal — edit that one file
to point at a deployed API, no JS changes or rebuild-from-source needed. It defaults to `http://localhost:3000` for
local dev.

Before packaging a release, regenerate the build hash the service worker self-reports (includes `config.json`, so a
tampered config is caught the same way a tampered source file would be):

```
node extension/build-hash.js
```

The API's CORS middleware (`server/src/cors.js`) always allows `chrome-extension://` origins regardless of
`WEB_ORIGIN` — the extension's id isn't a secret, and bearer-token auth means CORS isn't the security boundary for
those calls. Verified against a real unpacked extension loaded in headless Chromium: `config.json` resolves
correctly and a live call to `GET /consent/notice` succeeds end to end.

## Deployment

```
cp .env.example .env   # set POSTGRES_PASSWORD, APP_DB_PASSWORD, JWT_SECRET, WEB_ORIGIN, VITE_API_BASE
docker compose up --build
```

Brings up Postgres, the API (`localhost:3000`), and the web app (`localhost:8080`). The server's
`docker-entrypoint.sh` runs `scripts/migrate.js` (applies `migrations/*.sql` in order, tracked in a
`schema_migrations` table — safe to run on every container start, unlike the manual `psql -f` sequence above) and
`seeds/seed-ai-tools.js` before starting, so a fresh stack is ready with no manual steps. Data persists in the
`postgres_data` volume across restarts.

`POSTGRES_PASSWORD` and `APP_DB_PASSWORD` are both required (no default) — the compose file fails fast if either is
unset rather than silently starting with a guessable password. `APP_DB_PASSWORD` is for a separate,
least-privilege `shieldai_app` role (`server/scripts/init-app-role.sh`, provisioned automatically on a fresh
Postgres volume via the official image's `docker-entrypoint-initdb.d` mechanism) that the app's own runtime queries
use instead of the migrations' superuser role — contains the blast radius of any future SQL-injection-class bug to
exactly the DML the app issues. Note this only runs on a *fresh* volume; an existing `postgres_data` volume from
before this change needs the same `CREATE ROLE`/`GRANT` statements applied manually once.

### Backup / restore

```
server/scripts/backup.sh                              # writes server/backups/shieldai-<timestamp>.dump
server/scripts/restore.sh server/backups/shieldai-<timestamp>.dump
```

Both run `pg_dump`/`pg_restore` *inside* the `postgres` container (via `docker compose exec`), not a host-installed
client — a host client on a different Postgres major version can produce or expect a dump format the actual server
version doesn't, so this keeps the tool version pinned to whatever `docker-compose.yml` runs. `restore.sh` drops
and recreates every object first (`--clean --if-exists`), so the target ends up matching the dump exactly rather
than merging with what's already there — it prompts for confirmation unless you pass `--yes`. Needs the same
superuser connection migrations use (not the least-privilege `shieldai_app` role, which lacks `CREATE`).
`server/backups/` is gitignored; ship dumps to real off-box storage yourselves, this only automates the
dump/restore commands, not retention or transport.

`web/Dockerfile` builds the Vite app and serves it via nginx with an SPA fallback (`nginx.conf`) — every path
(`/`, `/verify-email`, etc.) serves `index.html` since routing is entirely client-side via query params, not
real paths. `nginx.conf` also sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` — the dashboard has
one-click, no-confirm destructive actions (revoke device/session/install-token) and bearer-token auth gives no
CSRF token to lean on, so refusing to be framed closes the UI-redressing angle.

Not yet built: TLS termination, a process manager/orchestrator beyond `docker compose` (e.g. Kubernetes
manifests), and log shipping/monitoring — this gets a pilot running, not a hardened production fleet.

## API summary

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `GET /auth/me`, `POST /auth/logout` | password auth + JWT sessions + email verification (Section 7) |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | password reset — single-use ticket, revokes other sessions |
| `POST /org/:orgId/invites`, `POST /auth/accept-invite` | admin invites a teammate by email + role; accepting sets a password and logs in |
| `GET /auth/sso/login`, `GET /auth/sso/callback` | generic OIDC SSO login — Okta/Azure AD/any compliant IdP (Section 6) |
| `GET /auth/sessions`, `POST /auth/sessions/:id/revoke` | self-service session management ("log out other devices") |
| `POST/GET /org/:orgId/install-tokens`, `.../install-tokens/:id/revoke`, `GET /org/:orgId/devices`, `.../devices/:id/revoke` | admin-issued device credentials (Section 7) |
| `GET /org/:orgId/sessions`, `POST /org/:orgId/sessions/:id/revoke` | admin kills any session in their org — incident response for a stolen laptop/leaked token |
| `GET /org/:orgId/audit-log` | unified log of every admin grant/revoke/review action in the org, newest first |
| `POST /extension/register-device`, `POST /extension/verify-device`, `GET /extension/device-status` | install-token exchange + email verification for devices (a new/unverified email gets a polling ticket, not a token, until the emailed link is clicked) |
| `GET/POST /consent/*` | monitoring notice, acknowledgement, status (Section 4) |
| `GET/PATCH /org/:orgId/settings` | jurisdictions, gated feature toggles, DNS/proxy flag |
| `GET /org/security-summary` | retention/encryption/sub-processor summary (Section 3) |
| `POST /extension/config` | extension self-reports version/build hash |
| `GET /org/:orgId/extension-versions` | build verification status per install |
| `POST /tools/classify`, `GET/PATCH /tools/unverified` | unknown-tool classifier + review queue (Section 2) |
| `GET /org/:orgId/coverage-map` | per-org detection coverage status (Section 1) |
| `POST /native-app/detect` | native desktop app egress detection |
| `POST /integrations/scan`, `GET/PATCH /integrations/discovered` | SSO OAuth-grant discovery |
| `POST /activity/events`, `GET /activity/events`, `GET /activity/summary` | real activity ingestion + per-tool usage rollup (Section 8) |
| `GET /tools/library`, `POST /tools/library` | AI tool library listing (filterable by category/source) + manual add (Section 12 / 1.2) |

All admin-dashboard routes above require `Authorization: Bearer <jwt>` (a user session) and 403 on an org mismatch; `/tools/library` requires an admin from any org (the library is shared, not per-org). `POST /consent/acknowledge`, `GET /consent/status`, `POST /extension/config`, `POST /native-app/detect`, and `POST /activity/events` require `Authorization: Bearer <device token>` instead — org_id/user_id come from the token, never the request body, and a device-token-typed JWT is rejected by the user-session middleware and vice versa. `POST /extension/register-device` (the install-token exchange) and `GET /consent/notice` are the only genuinely public device-facing routes. `GET /org/security-summary` is intentionally public too (Section 3.2 — security reviewers pull it before they're even a customer).

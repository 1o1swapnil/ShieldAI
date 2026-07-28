# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Real SMTP sending (`nodemailer`) behind `sendVerificationEmail`, replacing
  the console-log-only stub. Unset `SMTP_HOST` (the default) still logs to
  stdout for local dev/tests — no real mailbox needed. Set `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` to send
  for real, against any standard SMTP provider. Wired into
  `docker-compose.yml` and both `.env.example` files.

### Fixed
- Registration (`/auth/register` and `/extension/register-device`) is now
  transactional. Previously, if the verification email failed to send
  after the org/user (or device) rows were already committed, the caller
  got a 500 but the account existed anyway — retrying just hit "email
  already registered" with no way to get a working verification link.
  Found via live testing with a deliberately broken SMTP config; both
  routes now roll back entirely on a failed send, so retrying with the
  same email works cleanly once the underlying problem is fixed.

### Verified
- Live, against a real (Ethereal test) SMTP server: an actual email was
  sent, accepted (`250 Accepted`), and delivered with the correct
  subject/recipient — not just "didn't throw." A deliberately broken SMTP
  config surfaced a genuine `535 Authentication failed` error and a clean
  500, and confirmed the fix: no orphaned org/user was left behind, and
  retrying the same email after restoring SMTP succeeded.

## [0.8.0] - 2026-07-28

### Added
- Deployment artifacts: `server/Dockerfile`, `web/Dockerfile` (multi-stage,
  built assets served via nginx with SPA fallback so `/verify-email` and
  similar paths don't 404), root `docker-compose.yml` wiring
  Postgres + server + web, and `.env.example`.
- `server/scripts/migrate.js` — a real migration runner (tracked in a new
  `schema_migrations` table), replacing the manual `psql -f` sequence for
  automated container startup. Idempotent: safe to run on every boot.
  `docker-entrypoint.sh` runs it, then the AI-tool seed script, then starts
  the server.
- CI gained a `docker-build` job (both images), now a required status
  check alongside the existing three.

### Verified
- Live, with the actual containers: `docker compose up` brings up a fresh
  stack with zero manual steps — all 11 migrations apply, the tool library
  seeds, register → verify-email → login works end to end through the
  exposed ports, CORS is correctly wired between the two container
  origins, the nginx SPA fallback correctly serves `/verify-email`
  (would otherwise 404), and a server container restart correctly skips
  already-applied migrations while data persists in the Postgres volume.

## [0.7.0] - 2026-07-27

### Added
- Revocation for user-session JWTs, mirroring the device-token model
  (migration 0011): a `sessions` row per login/verify-email/SSO callback,
  carried in the token as `sid`, checked live against the DB on every
  `requireAuth` call — the token's 24h expiry is a backstop, the row is
  the real kill switch. Deploying this forces everyone to re-authenticate
  (existing tokens have no `sid` to match).
- `POST /auth/logout` revokes the current session server-side (previously
  "log out" only deleted the local copy — the token stayed valid).
- Self-service session management: `GET /auth/sessions`, `POST
  /auth/sessions/:id/revoke` ("log out other devices"), surfaced in a new
  web Sessions tab.
- Admin incident response: `GET /org/:orgId/sessions`, `POST
  /org/:orgId/sessions/:id/revoke` — an admin can kill any session in
  their org (e.g. a stolen laptop) without the compromised account's
  cooperation. Same tab, admin view.

### Verified
- Live: a revoked session's still-valid, unexpired JWT is rejected
  immediately, both via self-logout and via an admin revoking a
  teammate's session from a separate login; cross-org session access is
  rejected with a 403.

## [0.6.0] - 2026-07-27

### Added
- Rate limiting on `/auth/login` and `/auth/register` (`src/rateLimit.js`)
  — a small in-memory fixed-window limiter, no new dependency. Login is
  gated by two independent limiters: per-IP (30/15min, catches a script
  hammering many accounts from one source) and per-email (8/15min, catches
  distributed credential stuffing against one account). Register is
  gated per-IP (5/hour). Both return `429` with a `Retry-After` header.
  `req.ip` reflects the load balancer's address unless `trust proxy` is
  configured for the real deployment — documented in the README.

## [0.5.0] - 2026-07-27

### Added
- CORS middleware (`src/cors.js`) — the API previously had none, which
  would break every browser request once the web app and API sit on
  different origins (the normal production case).
- Email verification, closing the "type any email, get attributed to it"
  identity gap flagged as a pilot blocker:
  - `users.email_verified_at`, `devices.verified_at` (migration 0010,
    with a backfill so pre-existing accounts/devices aren't silently
    locked out).
  - `POST /auth/register` no longer issues a session — it sends a
    verification link and returns `{pending: true}`. `POST /auth/login`
    403s until verified. `POST /auth/verify-email` completes registration
    and issues the first session in one step.
  - `POST /extension/register-device` only issues a device token
    immediately for a *returning, already-verified* email. A new/
    unverified email gets a polling ticket instead — the extension polls
    `GET /extension/device-status` until the human clicks the emailed
    link (`POST /extension/verify-device`, opened in a normal browser
    tab), which is the only thing that unlocks the real device token.
    Possessing the polling ticket alone never grants one.
  - SSO-provisioned users are marked verified immediately (the IdP
    already proved ownership as part of the org's directory).
  - `src/email.js`: no real mail provider wired up — logs the
    verification link to stdout in dev instead of pretending to send it;
    fails loudly rather than silently no-op-ing if `SMTP_HOST` is set.
  - Web app: `Login.jsx` shows the pending message instead of assuming a
    token; a new `?ticket=`/`?device_ticket=` landing (`VerifyDevice.jsx`)
    completes each flow.

### Verified
- Live: CORS reflects only configured origins; a fresh registration is
  rejected at login until verified, then works immediately after clicking
  the (console-logged) link; a new device gets no usable token at all
  until verification, while a returning verified user's reinstall skips
  the flow entirely; a fabricated/wrong-secret ticket is rejected.

## [0.4.0] - 2026-07-27

### Added
- Device-token auth (Section 7) for the extension's own ingestion
  endpoints. `install_tokens` (admin-issued, revocable) and `devices`
  (individually revocable) tables; `POST /extension/register-device`
  exchanges an install token for a long-lived (400d) device JWT;
  `requireDeviceAuth` middleware verifies the token AND checks live
  revocation status against the DB on every request — the JWT's own
  expiry is a backstop, not the real kill switch.
- `POST /consent/acknowledge`, `GET /consent/status`, `POST
  /extension/config`, `POST /native-app/detect`, and `POST
  /activity/events` now require a device token; org_id/user_id come from
  it instead of the request body. Closes the last "trust whatever
  org_id/user_id the client sends" gap (the admin-dashboard routes were
  closed in the prior auth/SSO release).
- Admin UI/API to create, list, and revoke install tokens and registered
  devices per org (`/org/:orgId/install-tokens`, `/org/:orgId/devices`,
  a Devices admin page).
- Extension: the Monitoring Notice screen now collects an install token
  (from the install link) + work email, exchanges them for a device
  token, and uses it for every subsequent call — replacing the placeholder
  org_id/user_id URL params.

### Verified
- Live: a revoked device's still-valid, unexpired JWT is rejected
  (`device revoked or not found`); a revoked install token blocks new
  registrations without affecting already-registered devices; a
  user-session JWT is rejected by device-auth middleware and vice versa.

## [0.3.0] - 2026-07-27

### Added
- AI tool library (v1.0 base, Section 12): `ai_tools` gains `category`,
  `source` (`library_seed` | `classifier_confirmed` | `admin_manual`), and
  `added_at`; a 150+ tool seed list across 15 categories
  (`server/seeds/ai_tools.json`) with an idempotent seed script;
  `GET /tools/library` (filterable by category/source) and
  `POST /tools/library` for manually registering internal/self-hosted
  tools (closes the Section 1.2 "admin adds internal tool entries" gap); a
  Tool Library admin page.
- Classifier-confirmed and admin-added tools are now tagged with the
  correct `source` instead of all rows looking the same.
- Authentication + SSO (v1.0 base, Sections 6-7): `users` gains
  `password_hash`, `role` (`admin`|`employee`), `auth_provider`, and
  `sso_issuer`/`sso_subject`. `POST /auth/register`, `POST /auth/login`,
  `GET /auth/me` (password auth, scrypt hashing, JWT sessions). A generic
  OIDC relying-party flow (`GET /auth/sso/login` / `/callback`) —
  authorization code + PKCE, remote-JWKS id_token verification via `jose`
  — works against Okta, Azure AD, or any standards-compliant IdP via env
  vars, no vendor SDK.
- `requireAuth`/`requireAdmin`/`requireOrgMatch` middleware retrofitted
  onto every admin-dashboard route (settings, coverage map, unverified
  queue, tool library, discovered integrations, activity log/summary,
  extension versions): a request now 401s with no token and 403s if the
  token's org doesn't match the org being acted on, instead of trusting
  whatever `org_id` the client sent. Device-facing ingestion routes
  (`/consent/acknowledge`, `/extension/config`, `/native-app/detect`,
  `/activity/events`) are deliberately left unauthenticated for now — that
  needs a per-install device-token model, not a browser-session JWT.
- Web app: Login/Register page, JWT stored client-side and attached to
  every admin API call, org id now comes from the authenticated session
  instead of a manually-pasted org id.

## [0.2.0] - 2026-07-27

### Added
- Activity events pipeline (v1.0 base, Section 8): `activity_events` table,
  `POST /activity/events` ingestion endpoint, `GET /activity/events` log,
  `GET /activity/summary` per-tool usage rollup, an Activity Summary
  admin page, and an extension content script (static on the known-tool
  domains, dynamically registered on `<all_urls>` once the optional
  permission is granted) that feeds it.
- The unknown-tool classifier's aggregate-usage signal (distinct users,
  session length) is now computed from real stored activity, not trusted
  client-supplied numbers — shared via a new `classifyDomain`/`queue`
  module used by both `/tools/classify` and `/activity/events`.

### Fixed
- A thrown/rejected error in any async route handler crashed the entire
  server process (no error-handling middleware existed). Upgraded to
  Express 5, which forwards async rejections to error middleware instead
  of crashing, and added that middleware.
- `activity_events.session_id` was typed `UUID` but extension-generated
  session ids (`"tab-<tabId>"`) aren't UUIDs; changed to `VARCHAR(64)`.

## [0.1.0] - 2026-07-27

### Added
- Scaffolded the ShieldAI platform: Node/Express + Postgres server, Vite/React
  admin/employee web app, Manifest V3 browser extension.
- **Section 4 — Employee notice & consent**: `consent_log` table, monitoring
  notice screen in the extension install flow, jurisdiction configuration
  gating incognito monitoring and the native-app companion.
- **Section 3 — Extension trust & permissions**: `optional_host_permissions`
  + `declarativeNetRequest` in place of blanket `<all_urls>`, in-product
  permission justification screen, `GET /org/security-summary`, signed-build
  verification (`extension_builds` / `extension_installs`).
- **Section 2 — Unknown AI tool classifier**: feature extraction (domain
  tokens, TLS cert, RDAP registration age, page title, tech fingerprint,
  aggregate usage), a weighted v0 scorer standing in for a trained GBT,
  `unverified_tools_queue` with plain-language explainability.
- **Section 1 — Detection coverage**: honest coverage-map reframing,
  native-app egress detection reusing the `ai_tools` domain table, SSO
  OAuth-grant discovery (`discovered_integrations`) with fuzzy tool matching.
- README with setup instructions and an API route summary.
- Proprietary LICENSE.
- GitHub Actions CI: server test suite, web production build, extension
  JSON validation.
- CODEOWNERS (`* @1o1swapnil`) and branch protection on `master`: required
  status checks (`server-test`, `web-build`, `extension-lint`), 1 code-owner
  review, no direct pushes for non-admins.
- CONTRIBUTING.md documenting the branch/PR process.
- Pull request template.

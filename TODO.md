# Pilot-readiness backlog

Punch list from the pre-pilot review. Not urgent enough to block anything currently planned — tracked here to implement later.

## Top priority

- ~~Extension `API_BASE` hardcoded to `localhost:3000`~~ — **done.** Moved to `extension/config.json`
  (`{"apiBase": "..."}`), read by both `background.js` and `notice.js`; included in the `build-hash.js` signed-build
  hash. Fixing this surfaced a real bug: the extension's own pages got blocked by the server's CORS middleware
  (`chrome-extension://` origins weren't in the `WEB_ORIGIN` allowlist) — fixed in `server/src/cors.js` (always
  allow `chrome-extension://` origins; bearer-token auth means CORS isn't the security boundary there anyway).
  Verified live: a real unpacked extension loaded in headless Chromium successfully read `config.json` and called
  the live API end to end.
- ~~No password reset / account recovery~~ — **done.** `POST /auth/forgot-password` (no-enumeration: identical
  response whether or not the email exists or uses password auth) + `POST /auth/reset-password` (single-use ticket
  bound to a password-hash fingerprint, revokes every other session on reset, logs in immediately with a fresh one).
  Verified live end to end including the replay-rejection and no-enumeration properties.
- ~~No `/health` endpoint~~ — **done.** `GET /health` (`server/src/routes/health.js`) round-trips a `SELECT 1`
  against Postgres and returns 200/`{"status":"ok"}` or 503/`{"status":"error"}` — a live-but-DB-unreachable
  server now reports unhealthy instead of looking fine. `web/nginx.conf` gets a dedicated `/health` route (plain
  200 "ok") distinct from the SPA fallback, which always 200s even on a broken build. Both wired into
  `docker-compose.yml` healthchecks (`server` via `node -e` HTTP GET, `web` via `wget`), with `web` now
  `depends_on: server: condition: service_healthy`. Verified: unit tests cover both branches by stubbing
  `pool.query`; the built `web` image was run standalone and its `/health` route confirmed live (200 "ok").
- ~~SSO login let a caller pick which org a new identity is provisioned into~~ — **done.** The OIDC config is a
  single shared deployment-wide setting, not per-org, so `GET /auth/sso/login?org_id=<X>` previously let anyone
  who could complete a real login against that IdP self-provision as an `employee` of any org whose UUID they
  could see. `server/src/routes/sso.js` now only auto-provisions a first-time SSO identity into an org that
  already has a member with a matching email domain.
- ~~SSRF via attacker-controlled `domain` into a raw TLS connect~~ — **done.** `domain` in `POST /activity/events`
  (device-token only) fed straight into `tls.connect({host: domain})` in the classifier's cert-issuer collector,
  letting a device-token holder probe internal hosts on port 443. `server/src/classifier/collectors.js` now
  resolves the domain itself, refuses private/loopback/link-local/CGNAT addresses, and connects to the already-
  resolved address (closes the SSRF and a DNS-rebinding TOCTOU). Covered by `server/test/collectors.test.js`.
- ~~`POST /extension/register-device` returned the same ticket needed to self-verify a device~~ — **done.** The
  polling ticket returned to the caller and the verification ticket emailed to the user are now distinct token
  types (`device_poll` vs `device_verification`), so holding the polling ticket no longer lets a caller skip the
  "prove you control this inbox" step. Covered by new tests in `server/test/deviceAuth.test.js`.
- ~~Unverified Tools admin tab was completely broken~~ — **done.** `web/src/pages/UnverifiedToolsQueue.jsx` used a
  bare `fetch` instead of the shared `authFetch` helper, so it never sent the bearer token and always 401'd. Now
  goes through `getUnverifiedTools`/`reviewUnverifiedTool` in `web/src/api.js`, matching every other admin page.
- ~~`requireOrgMatch` checked org mismatch before checking org_id was even present~~ — **done.** A request omitting
  `org_id` on `GET /activity/events`, `/activity/summary`, `/integrations/discovered`, or `/tools/unverified` got a
  misleading "org mismatch" 403 instead of "org_id is required" 400, and made each handler's own `org_id` check
  dead code. `server/src/auth/middleware.js` now checks presence before comparing; redundant handler-level checks
  removed. Covered by `server/test/middleware.test.js`.
- ~~`register-device` let a caller bind a device to another org's existing user~~ — **done.** It looked up users by
  email only, with no check that the user's org matched the install token's org — an Org B admin who knew any
  email already verified elsewhere could mint a device token asserting `{orgId: Org B, userId: <Org A's real
  user>}`. `server/src/routes/extension.js` now 409s if the looked-up user's `org_id` doesn't match the install
  token's org. Covered by `server/test/extensionRegisterDevice.test.js`.
- ~~`email` was never validated as a single address, enabling SMTP recipient-list injection~~ — **done.**
  `POST /auth/register` and `POST /extension/register-device` only checked `email` was non-empty; nodemailer
  parses comma/semicolon-separated `to` values as multiple independent recipients, so ShieldAI's own SMTP relay
  could be used to blast a legitimate verification email to an attacker-chosen recipient list. Added
  `isValidEmail()` in `server/src/email.js`, enforced at both intake routes plus as a hard backstop inside
  `send()` itself. Covered by expanded `server/test/email.test.js`.
- ~~`PATCH /tools/unverified/:id` trusted `reviewed_by` from the request body~~ — **done.** An admin could attribute
  a review decision to an arbitrary user id, weakening the audit trail. `server/src/routes/tools.js` now derives
  `reviewed_by` from `req.user.sub` (the authenticated admin) instead.

## Known, already-documented gaps

- `extension/rules.json` hardcodes 2 example domains (chatgpt.com, claude.ai) instead of the real 150+ tool library
  (`server/seeds/ai_tools.json`) — needs a build step generating rules.json from the library.
- SSO OAuth-grant *discovery* connector (pulling grants from Okta/Azure's admin API) is still a manual-input
  endpoint (`POST /integrations/scan` takes grants as body params) — no live connector to the IdP's management API.
- Native-app companion (Section 1.3) has a DB table (`native_app_detections`) and endpoint
  (`POST /native-app/detect`) but no actual installable companion process exists.
- ML classifier (`server/src/classifier/`) is still the v0 weighted-heuristic scorer — no real GBT training loop
  against the `unverified_tools_queue` feedback data.
- SOC 2 / pentest still "in progress" (Trust & Security page is honest about this); jurisdiction compliance
  checklist text (`server/src/notice.js`) is sourced language, not counsel-reviewed.
- No deployment orchestration beyond `docker compose` (no Kubernetes manifests etc.), no TLS termination, no log
  shipping/monitoring/alerting.
- No backup/restore procedure documented for the Postgres volume — real risk once there's real customer data in it.
- No admin invite flow — can't add a second admin to an org without touching the DB directly.
- No unified admin audit log — revocation/review actions are scattered across `reviewed_by`/`revoked_at` columns
  per table (devices, sessions, unverified_tools_queue, discovered_integrations), not one place to look.
- CI only runs unit tests (`.github/workflows/ci.yml`) — every "live verification" done during development was
  manual, in throwaway Postgres sessions. Nothing in CI would catch a regression in, say, the transactional-
  registration fix or CORS if a future change broke it. Consider adding a DB-backed integration test job (Postgres
  service container + a scripted smoke test against a running server).
- Rate limiter (`server/src/rateLimit.js`) is in-memory, single-process — fine for one instance, would need a
  shared store (Redis) if this ever runs behind a load balancer with multiple server replicas.

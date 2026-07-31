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
- ~~`users.email` was case-sensitive everywhere, bypassing the register-device cross-org guard~~ — **done.** Every
  real mail provider folds local-part case on delivery, so a case-flipped variant of a real victim's email (e.g.
  `Victim@Company.com` vs `victim@company.com`) was silently treated as a brand-new, unrelated user, letting an
  attacker register that variant under their own org's install token and get a verification email delivered to
  the real victim's inbox. `migrations/0012_case_insensitive_email.sql` lowercases existing data and replaces the
  plain unique index with one on `LOWER(email)`; `normalizeEmail()` in `server/src/email.js` is now applied before
  every lookup/write touching `users.email` in `auth.js`, `extension.js`, and `sso.js`. Covered by new tests in
  `server/test/email.test.js` and `server/test/extensionRegisterDevice.test.js`.
- ~~SSO domain-match fix had a fallback-domain hole~~ — **done.** When the IdP gave no `email` claim, the fix fell
  back to a constant `sso.local` domain — once any org had one such no-email SSO user, that org's domain gate was
  permanently satisfied for any other no-email identity from the same shared IdP. `server/src/routes/sso.js` now
  refuses first-time auto-provisioning outright when there's no real email claim. Covered by `server/test/sso.test.js`.
- ~~No clickjacking protection on the admin console~~ — **done.** The dashboard has one-click, no-confirm
  destructive actions (revoke device/session/install-token) and bearer-token auth gives no CSRF token to lean on.
  `web/nginx.conf` now sends `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- ~~App runtime connected to Postgres as the migrations' superuser~~ — **done.** A future SQL-injection-class bug
  would have had full superuser blast radius instead of being contained to the app's own DML.
  `server/scripts/init-app-role.sh` provisions a least-privilege `shieldai_app` role (via
  `docker-entrypoint-initdb.d`, inheriting access to tables migrations create later through `ALTER DEFAULT
  PRIVILEGES`); `server/src/db.js` now connects via `APP_DATABASE_URL`, falling back to `DATABASE_URL` for local
  dev. Verified end-to-end against a real Postgres container (role creation, privilege inheritance, denial of
  `CREATE TABLE`/`CREATE EXTENSION`, and a full register → `/health` flow under the scoped role).
- ~~`POSTGRES_PASSWORD` silently defaulted to a weak, guessable value~~ — **done.** `docker-compose.yml` now
  requires it (and the new `APP_DB_PASSWORD`) with no default, matching `JWT_SECRET`'s existing fail-fast pattern.
  Also added `ALTER TABLE users ALTER COLUMN org_id SET NOT NULL` (`migrations/0013`) as cheap defense-in-depth —
  every insert path already supplies it, but a future bug that omitted it should fail loudly, not silently.

## Known, already-documented gaps

- ~~`extension/rules.json` hardcoded 2 example domains instead of the real 150+ tool library~~ — **done.**
  `extension/generate-rules.js` regenerates both `rules.json`'s DNR allow-rules and `manifest.json`'s
  `content_scripts` match list from `server/seeds/ai_tools.json` (152 domains, deduped/sorted); `--check` mode
  fails without writing if the committed files have drifted. This also fixes `background.js`'s own comment claim
  that "the known-150 list is already covered by the static `content_scripts` entry," which wasn't true until now.
  `build-info.json` regenerated to match. CI's `extension-lint` job now runs the `--check` mode so this can't
  silently drift back to a placeholder.
- Extension build-hash "verification" is cosmetic — `POST /extension/config` computes `verified` via
  `isVerifiedBuild()` (`server/src/buildVerify.js`), but nothing security-relevant is gated on it: every real
  endpoint (`/activity/events`, `/consent/acknowledge`, etc.) authorizes purely on the device token, and the only
  consumer of `verified` is a human-facing dashboard flag (`GET /:orgId/extension-versions`). The "hash" is a
  published SHA-256, not a secret or a signature, so a tampered/backdoored build can just self-report the real
  hash and still be marked verified. Closing this for real needs code signing / attestation, not a small patch —
  tracked here rather than fixed ad hoc.
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
- ~~No backup/restore procedure documented for the Postgres volume~~ — **done.** `server/scripts/backup.sh` /
  `restore.sh` run `pg_dump`/`pg_restore` inside the `postgres` container itself (not a host-installed client),
  keeping the dump format pinned to whatever Postgres version `docker-compose.yml` actually runs — a host/server
  version mismatch is exactly the failure mode hit while testing this (a newer host `pg_dump` produced a dump the
  container's own `pg_restore` rejected). `restore.sh` prompts for confirmation before its `--clean --if-exists`
  drop-and-recreate unless `--yes` is passed. Documented in the README. Verified end to end against a real
  `docker compose` Postgres container: insert → backup → drop → restore → data intact; decline-the-prompt path
  also verified to abort without touching the DB. Still just dump/restore commands, not retention or off-box
  shipping — that's on the operator.
- No admin invite flow — can't add a second admin to an org without touching the DB directly.
- No unified admin audit log — revocation/review actions are scattered across `reviewed_by`/`revoked_at` columns
  per table (devices, sessions, unverified_tools_queue, discovered_integrations), not one place to look.
- ~~CI only runs unit tests~~ — **done.** Added an `integration-test` job (`.github/workflows/ci.yml`) with a real
  Postgres service container: runs `server/scripts/migrate.js` against it, starts the real server, then runs
  `server/scripts/smoke-test.js` — register (the transactional org+user+email path) → rejected pre-verification
  login → verify (using the real ticket read off the dev-mailer console log, same as a human reading it from
  their inbox) → login → an authenticated org-scoped request → a `chrome-extension://` CORS check. Verified
  locally end-to-end against a real Postgres container before wiring into CI.
- Rate limiter (`server/src/rateLimit.js`) is in-memory, single-process — fine for one instance, would need a
  shared store (Redis) if this ever runs behind a load balancer with multiple server replicas.

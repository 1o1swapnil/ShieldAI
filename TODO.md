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
- **No password reset / account recovery.** An admin locked out of `/auth/login` has no path back except a raw DB
  edit. Needs a `POST /auth/forgot-password` + `POST /auth/reset-password` pair, same ticket pattern as email
  verification (`server/src/routes/auth.js`, `server/src/email.js`).
- **No `/health` endpoint.** `docker-compose.yml` only healthchecks Postgres — the `server`/`web` containers have
  none, so a load balancer/orchestrator can't tell if they're actually up. Add `GET /health` (server) and a static
  200 route (nginx already serves index.html, but a dedicated health path avoids conflating "nginx is up" with
  "app is usable").

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

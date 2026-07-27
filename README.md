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
```

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

`/auth/login` and `/auth/register` are rate-limited by `req.ip` (per-IP) and, for login, also by email. Behind a real reverse proxy/load balancer, call `app.set('trust proxy', ...)` in `src/index.js` with the correct hop count — otherwise every client behind the proxy shares Express's default IP (the proxy's own address) and the per-IP limiter becomes either useless or a shared bucket for everyone.

No real mail provider is wired up (`src/email.js`) — verification links are logged to stdout in dev. Set `SMTP_HOST` only once you've actually implemented sending there; until then it just fails loudly instead of silently pretending to send.

`0001_base.sql`'s `organizations`/`users` stub has since grown real auth columns (0008) — the rest of the real v1.0 base schema (e.g. a proper invite flow) still isn't part of this addendum.

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

Before packaging a release, regenerate the build hash the service worker self-reports:

```
node extension/build-hash.js
```

`background.js` points at `http://localhost:3000` by default — update `API_BASE` in `background.js` and `notice.js` for a deployed API.

## API summary

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `GET /auth/me` | password auth + JWT sessions + email verification (Section 7) |
| `GET /auth/sso/login`, `GET /auth/sso/callback` | generic OIDC SSO login — Okta/Azure AD/any compliant IdP (Section 6) |
| `POST/GET /org/:orgId/install-tokens`, `.../install-tokens/:id/revoke`, `GET /org/:orgId/devices`, `.../devices/:id/revoke` | admin-issued device credentials (Section 7) |
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

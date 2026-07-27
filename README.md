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

Set `JWT_SECRET` in production (an ephemeral one is generated per-process otherwise — fine for local dev, invalidates sessions on every restart). For SSO, set `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` (any standards-compliant OIDC provider — Okta, Azure AD, etc.) and `WEB_ORIGIN` (where the callback redirects with the issued token).

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

Before packaging a release, regenerate the build hash the service worker self-reports:

```
node extension/build-hash.js
```

`background.js` points at `http://localhost:3000` by default — update `API_BASE` in `background.js` and `notice.js` for a deployed API.

## API summary

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | password auth + JWT sessions (Section 7) |
| `GET /auth/sso/login`, `GET /auth/sso/callback` | generic OIDC SSO login — Okta/Azure AD/any compliant IdP (Section 6) |
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

All admin-dashboard routes above require `Authorization: Bearer <jwt>` and 403 on an org mismatch; `/tools/library` requires an admin from any org (the library is shared, not per-org). `POST /consent/acknowledge`, `POST /extension/config`, `POST /native-app/detect`, and `POST /activity/events` stay unauthenticated — they're called by the extension/device, not a logged-in browser session, and closing that gap needs a per-install device-token model the install-token flow hasn't been built for yet. `GET /org/security-summary` is intentionally public (Section 3.2 — security reviewers pull it before they're even a customer).

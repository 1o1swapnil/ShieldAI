# ShieldAI

Shadow AI governance platform. Implements the v1.1 design addendum:

- **Section 1** — honest coverage-map reframing, native-app egress detection, SSO OAuth-grant discovery
- **Section 2** — unknown AI tool classifier (feature extraction + review queue)
- **Section 3** — extension permission narrowing, trust/security summary, signed build verification
- **Section 4** — employee monitoring notice/consent, jurisdiction-gated feature toggles

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
```

Run tests and start the server:

```
npm test
npm start   # listens on PORT (default 3000)
```

`0001_base.sql` is a minimal `organizations`/`users` stub — the real v1.0 base schema (auth, SSO, activity events) isn't part of this addendum.

## Web

```
cd web
npm install
npm run dev     # dev server
npm run build   # production build to dist/
```

Set `VITE_API_BASE` (defaults to `http://localhost:3000`) if the API isn't running locally.

The app has no auth wired up yet — you paste an `organizations.id` directly into each admin page.

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
| `GET/POST /consent/*` | monitoring notice, acknowledgement, status (Section 4) |
| `GET/PATCH /org/:orgId/settings` | jurisdictions, gated feature toggles, DNS/proxy flag |
| `GET /org/security-summary` | retention/encryption/sub-processor summary (Section 3) |
| `POST /extension/config` | extension self-reports version/build hash |
| `GET /org/:orgId/extension-versions` | build verification status per install |
| `POST /tools/classify`, `GET/PATCH /tools/unverified` | unknown-tool classifier + review queue (Section 2) |
| `GET /org/:orgId/coverage-map` | per-org detection coverage status (Section 1) |
| `POST /native-app/detect` | native desktop app egress detection |
| `POST /integrations/scan`, `GET/PATCH /integrations/discovered` | SSO OAuth-grant discovery |

# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

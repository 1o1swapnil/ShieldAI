# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Pull request template.
- CONTRIBUTING.md documenting the branch/PR process.
- CODEOWNERS (`* @1o1swapnil`) and branch protection on `master`: required
  status checks (`server-test`, `web-build`, `extension-lint`), 1 code-owner
  review, no direct pushes for non-admins.
- GitHub Actions CI: server test suite, web production build, extension
  JSON validation.
- README with setup instructions and an API route summary.
- Proprietary LICENSE.

## [0.1.0] - Initial implementation

Scaffolded the ShieldAI platform (Node/Express + Postgres server, Vite/React
admin/employee web app, Manifest V3 browser extension) implementing the four
gaps from the v1.1 design addendum:

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

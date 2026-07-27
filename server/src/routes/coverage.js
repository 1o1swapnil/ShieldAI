const express = require('express');
const pool = require('../db');
const { COVERAGE_INTRO_TEXT, buildCoverageMap } = require('../coverageMap');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

router.get('/:orgId/coverage-map', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const orgId = req.params.orgId;

  const [orgRes, extRes, discRes] = await Promise.all([
    pool.query('SELECT dns_proxy_configured, native_app_companion_enabled FROM organizations WHERE id = $1', [orgId]),
    pool.query('SELECT COUNT(*)::int AS count FROM extension_installs WHERE org_id = $1', [orgId]),
    pool.query('SELECT COUNT(*)::int AS count FROM discovered_integrations WHERE org_id = $1', [orgId]),
  ]);
  if (!orgRes.rows.length) return res.status(404).json({ error: 'org not found' });
  const org = orgRes.rows[0];

  res.json({
    intro: COVERAGE_INTRO_TEXT,
    channels: buildCoverageMap({
      extensionInstallCount: extRes.rows[0].count,
      dnsProxyConfigured: org.dns_proxy_configured,
      nativeAppCompanionEnabled: org.native_app_companion_enabled,
      discoveredIntegrationsCount: discRes.rows[0].count,
    }),
  });
});

module.exports = router;

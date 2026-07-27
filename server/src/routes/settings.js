const express = require('express');
const pool = require('../db');
const { checklistFor, noticeConfigured } = require('../notice');
const { isVerifiedBuild } = require('../buildVerify');

const router = express.Router();

// 3.3: security teams pull this instead of trusting each employee's report.
router.get('/:orgId/extension-versions', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ei.user_id, ei.extension_version, ei.build_hash, ei.optional_host_permission_granted, ei.last_seen_at,
            eb.build_hash AS reviewed_build_hash
     FROM extension_installs ei
     LEFT JOIN extension_builds eb ON eb.version = ei.extension_version
     WHERE ei.org_id = $1
     ORDER BY ei.last_seen_at DESC`,
    [req.params.orgId]
  );
  res.json(
    rows.map((row) => ({
      user_id: row.user_id,
      extension_version: row.extension_version,
      optional_host_permission_granted: row.optional_host_permission_granted,
      last_seen_at: row.last_seen_at,
      verified: isVerifiedBuild(row.reviewed_build_hash ? { build_hash: row.reviewed_build_hash } : null, row.build_hash),
    }))
  );
});

router.get('/:orgId/settings', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT jurisdictions, incognito_monitoring_enabled, native_app_companion_enabled, checklist_overrides, dns_proxy_configured
     FROM organizations WHERE id = $1`,
    [req.params.orgId]
  );
  if (!rows.length) return res.status(404).json({ error: 'org not found' });
  const org = rows[0];
  res.json({
    jurisdictions: org.jurisdictions,
    incognito_monitoring_enabled: org.incognito_monitoring_enabled,
    native_app_companion_enabled: org.native_app_companion_enabled,
    dns_proxy_configured: org.dns_proxy_configured,
    notice_configured: noticeConfigured(org.jurisdictions),
    checklist: checklistFor(org.jurisdictions, org.checklist_overrides),
  });
});

// 4.2: admins pick jurisdictions and toggle the gated features. Enabling
// incognito monitoring or the native-app companion is rejected until
// jurisdictions is non-empty.
router.patch('/:orgId/settings', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT jurisdictions, incognito_monitoring_enabled, native_app_companion_enabled, checklist_overrides, dns_proxy_configured
     FROM organizations WHERE id = $1`,
    [req.params.orgId]
  );
  if (!rows.length) return res.status(404).json({ error: 'org not found' });
  const current = rows[0];

  const next = {
    jurisdictions: req.body.jurisdictions ?? current.jurisdictions,
    incognito_monitoring_enabled: req.body.incognito_monitoring_enabled ?? current.incognito_monitoring_enabled,
    native_app_companion_enabled: req.body.native_app_companion_enabled ?? current.native_app_companion_enabled,
    checklist_overrides: req.body.checklist_overrides ?? current.checklist_overrides,
    dns_proxy_configured: req.body.dns_proxy_configured ?? current.dns_proxy_configured,
  };

  if ((next.incognito_monitoring_enabled || next.native_app_companion_enabled) && !noticeConfigured(next.jurisdictions)) {
    return res.status(409).json({
      error: 'jurisdictions must be configured before enabling incognito monitoring or the native-app companion',
    });
  }

  const { rows: updated } = await pool.query(
    `UPDATE organizations
     SET jurisdictions = $1, incognito_monitoring_enabled = $2, native_app_companion_enabled = $3, checklist_overrides = $4, dns_proxy_configured = $5
     WHERE id = $6
     RETURNING jurisdictions, incognito_monitoring_enabled, native_app_companion_enabled, checklist_overrides, dns_proxy_configured`,
    [next.jurisdictions, next.incognito_monitoring_enabled, next.native_app_companion_enabled, next.checklist_overrides, next.dns_proxy_configured, req.params.orgId]
  );
  const org = updated[0];
  res.json({
    jurisdictions: org.jurisdictions,
    incognito_monitoring_enabled: org.incognito_monitoring_enabled,
    native_app_companion_enabled: org.native_app_companion_enabled,
    dns_proxy_configured: org.dns_proxy_configured,
    notice_configured: noticeConfigured(org.jurisdictions),
    checklist: checklistFor(org.jurisdictions, org.checklist_overrides),
  });
});

module.exports = router;

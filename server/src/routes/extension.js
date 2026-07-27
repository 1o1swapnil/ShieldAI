const express = require('express');
const pool = require('../db');
const { isVerifiedBuild } = require('../buildVerify');
const { signToken } = require('../auth/jwt');
const { requireDeviceAuth } = require('../auth/deviceMiddleware');

const router = express.Router();

// Device-token bootstrap: exchanges an admin-issued install token (once)
// for a long-lived, individually revocable device token. No prior auth
// needed here — the install token IS the credential.
router.post('/register-device', async (req, res) => {
  const { install_token, email } = req.body || {};
  if (!install_token || !email) {
    return res.status(400).json({ error: 'install_token and email are required' });
  }

  const { rows: tokenRows } = await pool.query(
    'SELECT id, org_id FROM install_tokens WHERE token = $1 AND revoked_at IS NULL',
    [install_token]
  );
  if (!tokenRows.length) return res.status(401).json({ error: 'invalid or revoked install token' });
  const { id: installTokenId, org_id: orgId } = tokenRows[0];

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId = userRows[0]?.id;
  if (!userId) {
    const { rows: created } = await pool.query(
      `INSERT INTO users (org_id, email, role, auth_provider) VALUES ($1, $2, 'employee', 'device') RETURNING id`,
      [orgId, email]
    );
    userId = created[0].id;
  }

  const { rows: deviceRows } = await pool.query(
    `INSERT INTO devices (org_id, user_id, install_token_id) VALUES ($1, $2, $3) RETURNING id`,
    [orgId, userId, installTokenId]
  );
  const deviceId = deviceRows[0].id;

  const deviceToken = signToken({ sub: deviceId, orgId, userId, type: 'device' }, { expiresIn: '400d' });
  res.status(201).json({ device_token: deviceToken, org_id: orgId, user_id: userId });
});

// 3.3: service worker self-reports its build on every poll. org_id/user_id
// come from the device token now, not the request body.
router.post('/config', requireDeviceAuth, async (req, res) => {
  const { version, build_hash, optional_host_permission_granted } = req.body || {};
  if (!version || !build_hash) {
    return res.status(400).json({ error: 'version and build_hash are required' });
  }

  const { rows } = await pool.query('SELECT build_hash FROM extension_builds WHERE version = $1', [version]);
  const verified = isVerifiedBuild(rows[0], build_hash);

  await pool.query(
    `INSERT INTO extension_installs (org_id, user_id, extension_version, build_hash, optional_host_permission_granted, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (org_id, user_id) DO UPDATE SET
       extension_version = EXCLUDED.extension_version,
       build_hash = EXCLUDED.build_hash,
       optional_host_permission_granted = EXCLUDED.optional_host_permission_granted,
       last_seen_at = NOW()`,
    [req.device.orgId, req.device.userId, version, build_hash, Boolean(optional_host_permission_granted)]
  );

  res.json({ verified });
});

module.exports = router;

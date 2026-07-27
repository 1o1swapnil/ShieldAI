const express = require('express');
const pool = require('../db');
const { isVerifiedBuild } = require('../buildVerify');

const router = express.Router();

// 3.3: service worker self-reports its build on every poll. Upserts the
// install row and tells the extension whether its build matches the
// reviewed extension_builds row for that version.
router.post('/config', async (req, res) => {
  const { org_id, user_id, version, build_hash, optional_host_permission_granted } = req.body || {};
  if (!org_id || !user_id || !version || !build_hash) {
    return res.status(400).json({ error: 'org_id, user_id, version, and build_hash are required' });
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
    [org_id, user_id, version, build_hash, Boolean(optional_host_permission_granted)]
  );

  res.json({ verified });
});

module.exports = router;

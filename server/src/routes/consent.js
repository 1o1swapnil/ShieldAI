const express = require('express');
const pool = require('../db');
const { NOTICE_VERSION, NOTICE_TEXT } = require('../notice');
const { requireDeviceAuth } = require('../auth/deviceMiddleware');

const router = express.Router();

// 4.1 (2a): what the extension shows before device registration — public,
// no credential needed yet at this point in the flow.
router.get('/notice', (req, res) => {
  res.json({ version: NOTICE_VERSION, text: NOTICE_TEXT });
});

// Has this device's user already acknowledged the current notice version?
router.get('/status', requireDeviceAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT 1 FROM consent_log
     WHERE user_id = $1 AND org_id = $2 AND notice_version = $3
     LIMIT 1`,
    [req.device.userId, req.device.orgId, NOTICE_VERSION]
  );
  res.json({ acknowledged: rows.length > 0, notice_version: NOTICE_VERSION });
});

// 4.1 (2b): log the acknowledgement as audit evidence. org_id/user_id come
// from the device token, not the request body — called right after
// POST /extension/register-device succeeds.
router.post('/acknowledge', requireDeviceAuth, async (req, res) => {
  const { notice_version } = req.body || {};
  if (!notice_version) return res.status(400).json({ error: 'notice_version is required' });
  if (notice_version !== NOTICE_VERSION) {
    return res.status(409).json({ error: 'stale notice_version, refetch GET /consent/notice' });
  }
  const { rows } = await pool.query(
    `INSERT INTO consent_log (user_id, org_id, notice_version, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, acknowledged_at`,
    [req.device.userId, req.device.orgId, notice_version, req.ip]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

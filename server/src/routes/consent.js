const express = require('express');
const pool = require('../db');
const { NOTICE_VERSION, NOTICE_TEXT } = require('../notice');

const router = express.Router();

// 4.1 (2a): what the extension shows before the install token step.
router.get('/notice', (req, res) => {
  res.json({ version: NOTICE_VERSION, text: NOTICE_TEXT });
});

// Has this user already acknowledged the current notice version?
router.get('/status', async (req, res) => {
  const { user_id, org_id } = req.query;
  if (!user_id || !org_id) {
    return res.status(400).json({ error: 'user_id and org_id are required' });
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM consent_log
     WHERE user_id = $1 AND org_id = $2 AND notice_version = $3
     LIMIT 1`,
    [user_id, org_id, NOTICE_VERSION]
  );
  res.json({ acknowledged: rows.length > 0, notice_version: NOTICE_VERSION });
});

// 4.1 (2b): log the acknowledgement as audit evidence.
router.post('/acknowledge', async (req, res) => {
  const { user_id, org_id, notice_version } = req.body || {};
  if (!user_id || !org_id || !notice_version) {
    return res.status(400).json({ error: 'user_id, org_id, and notice_version are required' });
  }
  if (notice_version !== NOTICE_VERSION) {
    return res.status(409).json({ error: 'stale notice_version, refetch GET /consent/notice' });
  }
  const { rows } = await pool.query(
    `INSERT INTO consent_log (user_id, org_id, notice_version, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, acknowledged_at`,
    [user_id, org_id, notice_version, req.ip]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

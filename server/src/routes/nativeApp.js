const express = require('express');
const pool = require('../db');
const { requireDeviceAuth } = require('../auth/deviceMiddleware');

const router = express.Router();

// 1.3: native-app companion reports "process X is resolving domain Y."
// Reuses ai_tools for the match — no new detection engine, just a
// different collection agent. org_id/user_id come from the device token;
// gated on the org having actually opted in (Section 4.2 also blocks
// enabling the toggle until jurisdictions are set).
router.post('/detect', requireDeviceAuth, async (req, res) => {
  const { process_name, domain } = req.body || {};
  if (!process_name || !domain) {
    return res.status(400).json({ error: 'process_name and domain are required' });
  }

  const { rows: orgRows } = await pool.query(
    'SELECT native_app_companion_enabled FROM organizations WHERE id = $1',
    [req.device.orgId]
  );
  if (!orgRows[0]?.native_app_companion_enabled) {
    return res.status(403).json({ error: 'native-app companion is not enabled for this org' });
  }

  const { rows: toolRows } = await pool.query('SELECT id FROM ai_tools WHERE domain = $1', [domain]);
  const aiToolId = toolRows[0]?.id || null;

  await pool.query(
    `INSERT INTO native_app_detections (org_id, user_id, process_name, domain, ai_tool_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.device.orgId, req.device.userId, process_name, domain, aiToolId]
  );

  res.json({ detected: Boolean(aiToolId), ai_tool_id: aiToolId, process_name, domain });
});

module.exports = router;

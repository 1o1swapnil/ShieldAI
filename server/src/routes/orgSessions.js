const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

// Incident response: an admin can kill any session in their org — e.g. a
// stolen laptop — without needing the compromised user's own cooperation.
router.get('/:orgId/sessions', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, u.email, u.role, s.created_at, s.last_seen_at, s.revoked_at
     FROM sessions s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.org_id = $1
     ORDER BY s.last_seen_at DESC`,
    [req.params.orgId]
  );
  res.json(rows);
});

router.post('/:orgId/sessions/:id/revoke', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id, revoked_at`,
    [req.params.id, req.params.orgId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

module.exports = router;

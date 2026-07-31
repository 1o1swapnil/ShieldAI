const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

router.get('/:orgId/audit-log', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.created_at, u.email AS actor_email
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.org_id = $1
     ORDER BY a.created_at DESC
     LIMIT 200`,
    [req.params.orgId]
  );
  res.json(rows);
});

module.exports = router;

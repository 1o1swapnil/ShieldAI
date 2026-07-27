const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');

const router = express.Router();

router.post('/:orgId/install-tokens', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { label } = req.body || {};
  const token = crypto.randomBytes(24).toString('base64url');

  const { rows } = await pool.query(
    `INSERT INTO install_tokens (org_id, token, label, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, token, label, created_at, revoked_at`,
    [req.params.orgId, token, label || null, req.user.sub]
  );
  res.status(201).json(rows[0]);
});

router.get('/:orgId/install-tokens', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, token, label, created_at, revoked_at FROM install_tokens WHERE org_id = $1 ORDER BY created_at DESC`,
    [req.params.orgId]
  );
  res.json(rows);
});

router.post('/:orgId/install-tokens/:id/revoke', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE install_tokens SET revoked_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id, revoked_at`,
    [req.params.id, req.params.orgId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.get('/:orgId/devices', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.user_id, u.email, d.registered_at, d.last_seen_at, d.revoked_at
     FROM devices d LEFT JOIN users u ON u.id = d.user_id
     WHERE d.org_id = $1
     ORDER BY d.last_seen_at DESC`,
    [req.params.orgId]
  );
  res.json(rows);
});

router.post('/:orgId/devices/:id/revoke', requireAuth, requireAdmin, requireOrgMatch(), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE devices SET revoked_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id, revoked_at`,
    [req.params.id, req.params.orgId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../auth/passwords');
const { signToken } = require('../auth/jwt');
const { requireAuth } = require('../auth/middleware');

const router = express.Router();

// Bootstraps a brand-new org + its first admin. There's no invite flow yet
// (that's a follow-on piece of Section 7) — this is how org #1 gets created.
router.post('/register', async (req, res) => {
  const { org_name, email, password } = req.body || {};
  if (!org_name || !email || !password) {
    return res.status(400).json({ error: 'org_name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });

  const { rows: orgRows } = await pool.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [org_name]);
  const orgId = orgRows[0].id;

  const { rows: userRows } = await pool.query(
    `INSERT INTO users (org_id, email, password_hash, role, auth_provider)
     VALUES ($1, $2, $3, 'admin', 'password')
     RETURNING id, org_id, email, role`,
    [orgId, email, hashPassword(password)]
  );
  const user = userRows[0];
  const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role });
  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { rows } = await pool.query(
    "SELECT id, org_id, email, password_hash, role FROM users WHERE email = $1 AND auth_provider = 'password'",
    [email]
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role });
  res.json({ token, user: { id: user.id, org_id: user.org_id, email: user.email, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

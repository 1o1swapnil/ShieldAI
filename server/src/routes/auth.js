const express = require('express');
const pool = require('../db');
const { hashPassword, verifyPassword } = require('../auth/passwords');
const { signToken, verifyToken } = require('../auth/jwt');
const { requireAuth } = require('../auth/middleware');
const { sendVerificationEmail } = require('../email');
const { createRateLimiter } = require('../rateLimit');

const router = express.Router();

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

// Brute-force guards. Two independent limiters on login: per-IP catches a
// script hammering many different accounts from one source; per-email
// catches many sources hammering one account (distributed credential
// stuffing). req.ip reflects the load balancer's address unless
// `app.set('trust proxy', ...)` is configured for the real deployment.
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: 'too many registration attempts from this address, try again later',
});
const loginLimiterByIp = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip,
  message: 'too many login attempts from this address, try again later',
});
const loginLimiterByEmail = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => (req.body?.email || '').toLowerCase(),
  message: 'too many login attempts for this account, try again later',
});

// Bootstraps a brand-new org + its first admin. There's no invite flow yet
// (that's a follow-on piece of Section 7) — this is how org #1 gets created.
// No session is issued until the email is verified (POST /auth/verify-email)
// — proves the registrant actually controls this address.
router.post('/register', registerLimiter, async (req, res) => {
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
     RETURNING id`,
    [orgId, email, hashPassword(password)]
  );
  const userId = userRows[0].id;

  const ticket = signToken({ sub: userId, email, type: 'email_verification' }, { expiresIn: '24h' });
  await sendVerificationEmail(email, `${WEB_ORIGIN}/verify-email?ticket=${encodeURIComponent(ticket)}`);

  res.status(201).json({ pending: true, message: 'Check your email to verify your account before logging in.' });
});

router.post('/login', loginLimiterByIp, loginLimiterByEmail, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { rows } = await pool.query(
    "SELECT id, org_id, email, password_hash, role, email_verified_at FROM users WHERE email = $1 AND auth_provider = 'password'",
    [email]
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  if (!user.email_verified_at) {
    return res.status(403).json({ error: 'email not verified — check your inbox for the verification link' });
  }

  const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role });
  res.json({ token, user: { id: user.id, org_id: user.org_id, email: user.email, role: user.role } });
});

// Completes registration: marks the email verified and issues the first
// session in one step (the link click IS the login).
router.post('/verify-email', async (req, res) => {
  const { ticket } = req.body || {};
  if (!ticket) return res.status(400).json({ error: 'ticket is required' });

  let payload;
  try {
    payload = verifyToken(ticket);
  } catch {
    return res.status(401).json({ error: 'invalid or expired verification link' });
  }
  if (payload.type !== 'email_verification') {
    return res.status(401).json({ error: 'not a verification ticket' });
  }

  const { rows } = await pool.query(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW())
     WHERE id = $1 AND email = $2
     RETURNING id, org_id, email, role`,
    [payload.sub, payload.email]
  );
  if (!rows.length) return res.status(404).json({ error: 'account not found' });

  const user = rows[0];
  const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role });
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

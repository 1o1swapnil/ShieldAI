const express = require('express');
const pool = require('../db');
const { hashPassword, verifyPassword, fingerprintPasswordHash } = require('../auth/passwords');
const { signToken, verifyToken } = require('../auth/jwt');
const { requireAuth } = require('../auth/middleware');
const { createSession } = require('../auth/sessions');
const { sendVerificationEmail, sendPasswordResetEmail, isValidEmail, normalizeEmail } = require('../email');
const { createRateLimiter } = require('../rateLimit');

const router = express.Router();

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

// Brute-force guards. Two independent limiters on login: per-IP catches a
// script hammering many different accounts from one source; per-email
// catches many sources hammering one account (distributed credential
// stuffing). req.ip reflects the load balancer's address unless
// `app.set('trust proxy', ...)` is configured for the real deployment.
const registerLimiter = createRateLimiter({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: 'too many registration attempts from this address, try again later',
});
const loginLimiterByIp = createRateLimiter({
  name: 'login-ip',
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip,
  message: 'too many login attempts from this address, try again later',
});
const loginLimiterByEmail = createRateLimiter({
  name: 'login-email',
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => (req.body?.email || '').toLowerCase(),
  message: 'too many login attempts for this account, try again later',
});
const forgotPasswordLimiter = createRateLimiter({
  name: 'forgot-password',
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: 'too many password reset attempts from this address, try again later',
});

// Bootstraps a brand-new org + its first admin — this is how org #1 gets
// created. Every user after that comes through POST /org/:orgId/invites +
// POST /accept-invite below instead. No session is issued until the email
// is verified (POST /auth/verify-email) — proves the registrant actually
// controls this address.
router.post('/register', registerLimiter, async (req, res) => {
  const { org_name, password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!org_name || !email || !password) {
    return res.status(400).json({ error: 'org_name, email, and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'email must be a single valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });

  // Transactional: if the verification email fails to send, roll back the
  // org/user creation entirely. Without this, a bad SMTP config leaves a
  // half-registered account behind with no working verification email and
  // no way to retry — the next attempt just 409s on "already registered."
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orgRows } = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      org_name,
    ]);
    const orgId = orgRows[0].id;

    const { rows: userRows } = await client.query(
      `INSERT INTO users (org_id, email, password_hash, role, auth_provider)
       VALUES ($1, $2, $3, 'admin', 'password')
       RETURNING id`,
      [orgId, email, hashPassword(password)]
    );
    const userId = userRows[0].id;

    const ticket = signToken({ sub: userId, email, type: 'email_verification' }, { expiresIn: '24h' });
    await sendVerificationEmail(email, `${WEB_ORIGIN}/verify-email?ticket=${encodeURIComponent(ticket)}`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ pending: true, message: 'Check your email to verify your account before logging in.' });
});

router.post('/login', loginLimiterByIp, loginLimiterByEmail, async (req, res) => {
  const { password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
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

  const sid = await createSession(pool, { userId: user.id, orgId: user.org_id });
  const token = signToken({ sub: user.id, sid, orgId: user.org_id, role: user.role });
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
  const sid = await createSession(pool, { userId: user.id, orgId: user.org_id });
  const token = signToken({ sub: user.id, sid, orgId: user.org_id, role: user.role });
  res.json({ token, user });
});

// Completes an admin-issued invite (POST /org/:orgId/invites): the ticket
// carries org_id/email/role, so this is how org #2+'s users get created —
// register only ever creates org #1's admin (see the comment above it).
// The click IS the login, same pattern as /verify-email: the ticket having
// been mailed to this address is the proof of ownership, so the account
// starts out email-verified.
router.post('/accept-invite', async (req, res) => {
  const { ticket, password } = req.body || {};
  if (!ticket || !password) return res.status(400).json({ error: 'ticket and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  let payload;
  try {
    payload = verifyToken(ticket);
  } catch {
    return res.status(401).json({ error: 'invalid or expired invite link' });
  }
  if (payload.type !== 'org_invite') {
    return res.status(401).json({ error: 'not an invite ticket' });
  }

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [payload.email]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });

  const { rows } = await pool.query(
    `INSERT INTO users (org_id, email, password_hash, role, auth_provider, email_verified_at)
     VALUES ($1, $2, $3, $4, 'password', NOW())
     RETURNING id, org_id, email, role`,
    [payload.orgId, payload.email, hashPassword(password), payload.role]
  );
  const user = rows[0];
  const sid = await createSession(pool, { userId: user.id, orgId: user.org_id });
  const token = signToken({ sub: user.id, sid, orgId: user.org_id, role: user.role });
  res.status(201).json({ token, user });
});

// Always returns the same generic response, whether or not the email is
// registered or even uses password auth (SSO/device accounts have no
// password to reset) — the response itself must never leak which emails
// exist in the system.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { rows } = await pool.query(
    "SELECT id, password_hash FROM users WHERE email = $1 AND auth_provider = 'password'",
    [email]
  );
  if (rows.length) {
    const pwFingerprint = fingerprintPasswordHash(rows[0].password_hash);
    const ticket = signToken({ sub: rows[0].id, email, pwFingerprint, type: 'password_reset' }, { expiresIn: '1h' });
    await sendPasswordResetEmail(email, `${WEB_ORIGIN}/?reset_ticket=${encodeURIComponent(ticket)}`);
  }

  res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
});

// The link click sets the new password and logs the user in immediately —
// same "click IS the login" pattern as /verify-email. A password reset
// means "I forgot it" at best and "this account may be compromised" at
// worst, so every other active session gets revoked at the same time.
router.post('/reset-password', async (req, res) => {
  const { ticket, password } = req.body || {};
  if (!ticket || !password) return res.status(400).json({ error: 'ticket and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  let payload;
  try {
    payload = verifyToken(ticket);
  } catch {
    return res.status(401).json({ error: 'invalid or expired reset link' });
  }
  if (payload.type !== 'password_reset') {
    return res.status(401).json({ error: 'not a password reset ticket' });
  }

  const { rows: existing } = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND email = $2', [
    payload.sub,
    payload.email,
  ]);
  if (!existing.length) return res.status(404).json({ error: 'account not found' });
  // The password already changed since this ticket was issued (a prior use
  // of it, or a separate reset) — reject the replay instead of allowing
  // the same emailed link to reset the password over and over.
  if (fingerprintPasswordHash(existing[0].password_hash) !== payload.pwFingerprint) {
    return res.status(401).json({ error: 'invalid or expired reset link' });
  }

  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 AND email = $3 RETURNING id, org_id, email, role`,
    [hashPassword(password), payload.sub, payload.email]
  );
  const user = rows[0];

  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);

  const sid = await createSession(pool, { userId: user.id, orgId: user.org_id });
  const token = signToken({ sub: user.id, sid, orgId: user.org_id, role: user.role });
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Revokes the current session — the server-side half of "log out."
router.post('/logout', requireAuth, async (req, res) => {
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [req.user.sid]);
  res.json({ ok: true });
});

// Self-service session management ("log out other devices").
router.get('/sessions', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, created_at, last_seen_at, revoked_at FROM sessions WHERE user_id = $1 ORDER BY last_seen_at DESC`,
    [req.user.sub]
  );
  res.json(rows.map((row) => ({ ...row, current: row.id === req.user.sid })));
});

router.post('/sessions/:id/revoke', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, revoked_at`,
    [req.params.id, req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

module.exports = router;

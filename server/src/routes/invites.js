const express = require('express');
const pool = require('../db');
const { signToken } = require('../auth/jwt');
const { requireAuth, requireAdmin, requireOrgMatch } = require('../auth/middleware');
const { sendInviteEmail, isValidEmail, normalizeEmail } = require('../email');
const { createRateLimiter } = require('../rateLimit');
const { logAudit } = require('../auditLog');

const router = express.Router();

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

// Same abuse surface as /auth/register: an admin token (stolen or
// otherwise) could otherwise turn this into a spam/phishing vector against
// arbitrary addresses via ShieldAI's own SMTP relay.
const inviteLimiter = createRateLimiter({
  name: 'invite',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user.sub,
  message: 'too many invites sent, try again later',
});

// No invites table: the ticket itself carries everything needed to
// provision the account (same stateless pattern as email verification /
// password reset), and the users.email uniqueness check on both ends is
// what makes it single-use. There's no server-side view of "invites sent
// but not yet accepted" as a result — for now, that's the accepted
// simplicity trade-off (see TODO.md).
router.post('/:orgId/invites', requireAuth, requireAdmin, requireOrgMatch(), inviteLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const role = req.body?.role === 'admin' ? 'admin' : 'employee';
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'email must be a single valid email address' });

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });

  const { rows: orgRows } = await pool.query('SELECT name FROM organizations WHERE id = $1', [req.params.orgId]);
  if (!orgRows.length) return res.status(404).json({ error: 'org not found' });

  const ticket = signToken(
    { orgId: req.params.orgId, email, role, invitedBy: req.user.sub, type: 'org_invite' },
    { expiresIn: '7d' }
  );
  await sendInviteEmail(email, `${WEB_ORIGIN}/?invite_ticket=${encodeURIComponent(ticket)}`, orgRows[0].name);
  await logAudit(pool, {
    orgId: req.params.orgId,
    actorUserId: req.user.sub,
    action: 'invite.created',
    targetType: 'invite',
    metadata: { email, role },
  });

  res.status(201).json({ message: 'Invite sent.' });
});

module.exports = router;

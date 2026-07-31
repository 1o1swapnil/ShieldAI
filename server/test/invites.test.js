const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const { signToken, verifyToken } = require('../src/auth/jwt');
const authRouter = require('../src/routes/auth');
const invitesRouter = require('../src/routes/invites');

// accept-invite is the 4th route registered in auth.js (register, login,
// verify-email, accept-invite), plain handler with no extra middleware.
const acceptInviteHandler = authRouter.stack[3].route.stack[0].handle;
// requireAuth, requireAdmin, requireOrgMatch(), inviteLimiter, handler.
const createInviteHandler = invitesRouter.stack[0].route.stack[4].handle;

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('org_invite ticket carries orgId/email/role, distinct from other ticket types', () => {
  const ticket = signToken(
    { orgId: 'org-1', email: 'a@example.com', role: 'admin', invitedBy: 'user-1', type: 'org_invite' },
    { expiresIn: '7d' }
  );
  const decoded = verifyToken(ticket);
  assert.equal(decoded.type, 'org_invite');
  assert.equal(decoded.orgId, 'org-1');
  assert.equal(decoded.role, 'admin');
});

test('accept-invite rejects a ticket that is not an org_invite type', async () => {
  const ticket = signToken({ sub: 'user-1', email: 'a@example.com', type: 'email_verification' }, { expiresIn: '1h' });
  const req = { body: { ticket, password: 'a-long-enough-password' } };
  const res = fakeRes();
  await acceptInviteHandler(req, res);
  assert.equal(res.statusCode, 401);
});

// The ticket is stateless and mails once, but nothing stops a slow invitee
// clicking it after the address got claimed some other way in the meantime
// (e.g. self-registered org #1 admin) — the users.email uniqueness check
// at accept time is what makes the ticket actually single-use.
test('accept-invite 409s if the invited email was registered before the link was clicked', async () => {
  const ticket = signToken({ orgId: 'org-1', email: 'taken@example.com', role: 'employee', type: 'org_invite' }, {
    expiresIn: '7d',
  });
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    assert.match(sql, /FROM users/);
    return { rows: [{ id: 'existing-user' }] };
  };
  try {
    const req = { body: { ticket, password: 'a-long-enough-password' } };
    const res = fakeRes();
    await acceptInviteHandler(req, res);
    assert.equal(res.statusCode, 409);
  } finally {
    pool.query = originalQuery;
  }
});

test('create-invite 409s if the email is already registered, before ever sending mail', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    assert.match(sql, /FROM users/);
    return { rows: [{ id: 'existing-user' }] };
  };
  try {
    const req = { params: { orgId: 'org-1' }, user: { sub: 'admin-1' }, body: { email: 'taken@example.com' } };
    const res = fakeRes();
    await createInviteHandler(req, res);
    assert.equal(res.statusCode, 409);
  } finally {
    pool.query = originalQuery;
  }
});

test('create-invite rejects a malformed/multi-recipient email before any DB lookup', async () => {
  const originalQuery = pool.query;
  pool.query = async () => {
    throw new Error('should not query for a malformed email');
  };
  try {
    const req = { params: { orgId: 'org-1' }, user: { sub: 'admin-1' }, body: { email: 'a@b.com,c@d.com' } };
    const res = fakeRes();
    await createInviteHandler(req, res);
    assert.equal(res.statusCode, 400);
  } finally {
    pool.query = originalQuery;
  }
});

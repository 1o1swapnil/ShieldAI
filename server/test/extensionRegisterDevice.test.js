const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const extensionRouter = require('../src/routes/extension');

// register-device is the first route registered in extension.js.
const registerDeviceHandler = extensionRouter.stack[0].route.stack[0].handle;

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

// A user's org is fixed for life. Reusing an existing user's email under a
// different org's install token would previously mint a device token
// asserting {orgId: <this org>, userId: <a different org's real user>} —
// this test locks in the fix: it must 409 before ever touching pool.connect
// (the transactional insert path), not silently bind across orgs.
test('register-device rejects an email that already belongs to a different org', async () => {
  const originalQuery = pool.query;
  let callCount = 0;
  pool.query = async (sql, params) => {
    callCount += 1;
    if (callCount === 1) {
      assert.match(sql, /install_tokens/);
      return { rows: [{ id: 'token-1', org_id: 'org-B' }] };
    }
    if (callCount === 2) {
      assert.match(sql, /FROM users/);
      return { rows: [{ id: 'user-1', org_id: 'org-A', email_verified_at: new Date() }] };
    }
    throw new Error(`unexpected extra pool.query call: ${sql}`);
  };
  const originalConnect = pool.connect;
  pool.connect = async () => {
    throw new Error('pool.connect should never be reached for a cross-org email');
  };

  try {
    const req = { body: { install_token: 'itok-1', email: 'victim@org-a.example' } };
    const res = fakeRes();
    await registerDeviceHandler(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /different organization/);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

// Every real mail provider folds local-part case on delivery, so a
// case-flipped variant of a victim's address must still be caught by the
// cross-org guard above — not treated as an unrelated, brand-new user.
test('register-device normalizes email case before the org-match lookup', async () => {
  const originalQuery = pool.query;
  let callCount = 0;
  pool.query = async (sql, params) => {
    callCount += 1;
    if (callCount === 1) {
      return { rows: [{ id: 'token-1', org_id: 'org-B' }] };
    }
    if (callCount === 2) {
      assert.equal(params[0], 'victim@org-a.example'); // lowercased before the query, not 'Victim@Org-A.example'
      return { rows: [{ id: 'user-1', org_id: 'org-A', email_verified_at: new Date() }] };
    }
    throw new Error(`unexpected extra pool.query call: ${sql}`);
  };
  const originalConnect = pool.connect;
  pool.connect = async () => {
    throw new Error('pool.connect should never be reached for a cross-org email');
  };

  try {
    const req = { body: { install_token: 'itok-1', email: 'Victim@Org-A.example' } };
    const res = fakeRes();
    await registerDeviceHandler(req, res);

    assert.equal(res.statusCode, 409);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('register-device rejects a malformed/multi-recipient email before any DB lookup', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    throw new Error(`pool.query should never be reached for an invalid email: ${sql}`);
  };

  try {
    const req = { body: { install_token: 'itok-1', email: 'a@example.com,attacker@evil.com' } };
    const res = fakeRes();
    await registerDeviceHandler(req, res);

    assert.equal(res.statusCode, 400);
  } finally {
    pool.query = originalQuery;
  }
});

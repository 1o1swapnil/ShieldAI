const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const { logAudit } = require('../src/auditLog');
const auditLogRouter = require('../src/routes/auditLog');

// requireAuth, requireAdmin, requireOrgMatch(), handler.
const listAuditLogHandler = auditLogRouter.stack[0].route.stack[3].handle;

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

test('logAudit inserts org/actor/action/target/metadata, JSON-encoding metadata', async () => {
  const originalQuery = pool.query;
  let captured;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  };
  try {
    await logAudit(pool, {
      orgId: 'org-1',
      actorUserId: 'admin-1',
      action: 'device.revoked',
      targetType: 'device',
      targetId: 'device-1',
      metadata: { note: 'stolen laptop' },
    });
  } finally {
    pool.query = originalQuery;
  }

  assert.match(captured.sql, /INSERT INTO audit_log/);
  assert.deepEqual(captured.params, [
    'org-1',
    'admin-1',
    'device.revoked',
    'device',
    'device-1',
    JSON.stringify({ note: 'stolen laptop' }),
  ]);
});

test('logAudit passes null for a target-less action (e.g. an invite) instead of undefined', async () => {
  const originalQuery = pool.query;
  let captured;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  };
  try {
    await logAudit(pool, {
      orgId: 'org-1',
      actorUserId: 'admin-1',
      action: 'invite.created',
      targetType: 'invite',
      metadata: { email: 'a@example.com', role: 'employee' },
    });
  } finally {
    pool.query = originalQuery;
  }

  assert.equal(captured.params[4], null);
});

test('GET /org/:orgId/audit-log scopes the query to the org and orders newest first', async () => {
  const originalQuery = pool.query;
  let captured;
  const fakeRows = [{ id: 'a1', action: 'device.revoked' }];
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: fakeRows };
  };
  try {
    const req = { params: { orgId: 'org-1' } };
    const res = fakeRes();
    await listAuditLogHandler(req, res);

    assert.deepEqual(captured.params, ['org-1']);
    assert.match(captured.sql, /WHERE a\.org_id = \$1/);
    assert.match(captured.sql, /ORDER BY a\.created_at DESC/);
    assert.equal(res.body, fakeRows);
  } finally {
    pool.query = originalQuery;
  }
});

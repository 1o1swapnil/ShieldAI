const test = require('node:test');
const assert = require('node:assert/strict');
const { requireOrgMatch } = require('../src/auth/middleware');

function fakeRes() {
  return {
    statusCode: null,
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

test('requireOrgMatch 400s when org_id is missing, not 403', () => {
  const mw = requireOrgMatch((req) => req.query.org_id);
  const req = { query: {}, user: { orgId: 'org-1' } };
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'org_id is required');
  assert.equal(nextCalled, false);
});

test('requireOrgMatch 403s when org_id is present but does not match the session', () => {
  const mw = requireOrgMatch((req) => req.query.org_id);
  const req = { query: { org_id: 'org-2' }, user: { orgId: 'org-1' } };
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'org mismatch');
  assert.equal(nextCalled, false);
});

test('requireOrgMatch calls next() when org_id matches the session', () => {
  const mw = requireOrgMatch((req) => req.query.org_id);
  const req = { query: { org_id: 'org-1' }, user: { orgId: 'org-1' } };
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken } = require('../src/auth/jwt');

test('a user session token carries sid alongside sub/org/role', () => {
  const token = signToken({ sub: 'user-1', sid: 'session-1', orgId: 'org-1', role: 'admin' });
  const decoded = verifyToken(token);
  assert.equal(decoded.sub, 'user-1');
  assert.equal(decoded.sid, 'session-1');
  assert.equal(decoded.orgId, 'org-1');
  assert.equal(decoded.type, undefined); // requireAuth rejects anything with a `type` marker
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken } = require('../src/auth/jwt');

test('a device token carries type=device plus org/user/device ids', () => {
  const token = signToken({ sub: 'device-1', orgId: 'org-1', userId: 'user-1', type: 'device' }, { expiresIn: '400d' });
  const decoded = verifyToken(token);
  assert.equal(decoded.type, 'device');
  assert.equal(decoded.sub, 'device-1');
  assert.equal(decoded.orgId, 'org-1');
  assert.equal(decoded.userId, 'user-1');
});

test('a regular user session token has no type=device marker', () => {
  const token = signToken({ sub: 'user-1', orgId: 'org-1', role: 'admin' });
  const decoded = verifyToken(token);
  assert.notEqual(decoded.type, 'device');
});

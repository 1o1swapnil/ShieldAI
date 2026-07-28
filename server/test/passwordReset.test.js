const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, fingerprintPasswordHash } = require('../src/auth/passwords');
const { signToken, verifyToken } = require('../src/auth/jwt');

test('fingerprintPasswordHash changes when the password hash changes', () => {
  const hashA = hashPassword('first-password');
  const hashB = hashPassword('second-password');
  assert.notEqual(fingerprintPasswordHash(hashA), fingerprintPasswordHash(hashB));
});

test('fingerprintPasswordHash is stable for the same hash', () => {
  const hash = hashPassword('a-password');
  assert.equal(fingerprintPasswordHash(hash), fingerprintPasswordHash(hash));
});

test('a password-reset ticket carries type + pwFingerprint, distinct from email verification', () => {
  const ticket = signToken(
    { sub: 'user-1', email: 'a@example.com', pwFingerprint: 'abc123', type: 'password_reset' },
    { expiresIn: '1h' }
  );
  const decoded = verifyToken(ticket);
  assert.equal(decoded.type, 'password_reset');
  assert.equal(decoded.pwFingerprint, 'abc123');
  assert.notEqual(decoded.type, 'email_verification');
});

test('replaying a reset ticket after the password already changed is detectable via fingerprint mismatch', () => {
  const originalHash = hashPassword('original-password');
  const pwFingerprint = fingerprintPasswordHash(originalHash);

  // Simulates the password having been changed since the ticket was issued
  // (either by a prior use of this same ticket, or a separate reset).
  const newHash = hashPassword('a-different-password');
  assert.notEqual(fingerprintPasswordHash(newHash), pwFingerprint);
});

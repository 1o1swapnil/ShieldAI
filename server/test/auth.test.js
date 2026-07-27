const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/auth/passwords');
const { signToken, verifyToken } = require('../src/auth/jwt');
const { generatePkce, buildAuthorizationUrl, signLoginTicket, verifyLoginTicket } = require('../src/auth/oidc');

test('hashPassword + verifyPassword round-trip', () => {
  const stored = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', stored), true);
  assert.equal(verifyPassword('wrong password', stored), false);
});

test('hashPassword salts each hash differently', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b);
});

test('signToken/verifyToken round-trip carries payload', () => {
  const token = signToken({ sub: 'user-1', orgId: 'org-1', role: 'admin' });
  const decoded = verifyToken(token);
  assert.equal(decoded.sub, 'user-1');
  assert.equal(decoded.orgId, 'org-1');
  assert.equal(decoded.role, 'admin');
});

test('verifyToken rejects a tampered token', () => {
  const token = signToken({ sub: 'user-1' });
  assert.throws(() => verifyToken(token.slice(0, -2) + 'xx'));
});

test('generatePkce produces a verifier and a matching S256 challenge', () => {
  const crypto = require('node:crypto');
  const { codeVerifier, codeChallenge } = generatePkce();
  const expected = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.equal(codeChallenge, expected);
});

test('buildAuthorizationUrl includes PKCE and state params', () => {
  const url = new URL(
    buildAuthorizationUrl({
      authorizationEndpoint: 'https://idp.example/authorize',
      clientId: 'client-1',
      redirectUri: 'https://app.example/callback',
      state: 'state-token',
      codeChallenge: 'challenge-value',
      nonce: 'nonce-value',
    })
  );
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), 'client-1');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state-token');
});

test('signLoginTicket/verifyLoginTicket round-trips org/verifier/nonce', () => {
  const state = signLoginTicket({ orgId: 'org-1', codeVerifier: 'verifier-1', nonce: 'nonce-1' });
  const ticket = verifyLoginTicket(state);
  assert.equal(ticket.orgId, 'org-1');
  assert.equal(ticket.codeVerifier, 'verifier-1');
  assert.equal(ticket.nonce, 'nonce-1');
});

test('verifyLoginTicket rejects a plain (non-ticket) token', () => {
  const notATicket = signToken({ orgId: 'org-1' });
  assert.throws(() => verifyLoginTicket(notATicket));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const oidc = require('../src/auth/oidc');
const ssoRouter = require('../src/routes/sso');

// /callback is the second route registered in sso.js.
const callbackHandler = ssoRouter.stack[1].route.stack[0].handle;

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
    redirect(url) {
      this.redirectUrl = url;
      this.statusCode = 302;
    },
  };
}

// The domain-match gate exists so a first-time SSO identity can only land in
// an org it plausibly belongs to. Falling back to a constant domain (e.g.
// "sso.local") when the IdP gives no email claim would let any other
// no-email identity from the same shared IdP piggyback into an org that
// already has one such user — so this must refuse outright instead.
test('SSO callback refuses to auto-provision a first-time identity with no email claim', async () => {
  process.env.OIDC_ISSUER_URL = 'https://idp.example';
  process.env.OIDC_CLIENT_ID = 'client-1';
  process.env.OIDC_CLIENT_SECRET = 'secret';
  process.env.OIDC_REDIRECT_URI = 'https://app.example/callback';

  const originalDiscover = oidc.discover;
  const originalVerifyLoginTicket = oidc.verifyLoginTicket;
  const originalExchangeCode = oidc.exchangeCode;
  const originalVerifyIdToken = oidc.verifyIdToken;
  const originalQuery = pool.query;

  oidc.discover = async () => ({
    authorization_endpoint: 'https://idp.example/authorize',
    token_endpoint: 'https://idp.example/token',
    jwks_uri: 'https://idp.example/jwks',
    issuer: 'https://idp.example',
  });
  oidc.verifyLoginTicket = () => ({ orgId: 'org-1', codeVerifier: 'verifier', nonce: 'nonce-1' });
  oidc.exchangeCode = async () => ({ id_token: 'fake-id-token' });
  oidc.verifyIdToken = async () => ({ sub: 'idp-subject-1', nonce: 'nonce-1' }); // no `email` claim
  let queryCalls = 0;
  pool.query = async (sql) => {
    queryCalls += 1;
    assert.match(sql, /sso_issuer/); // only the existing-identity lookup should ever run
    return { rows: [] };
  };

  try {
    const req = { query: { code: 'auth-code', state: 'state-ticket' } };
    const res = fakeRes();
    await callbackHandler(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /email claim/);
    assert.equal(queryCalls, 1); // never reached the domain-match or insert queries
  } finally {
    oidc.discover = originalDiscover;
    oidc.verifyLoginTicket = originalVerifyLoginTicket;
    oidc.exchangeCode = originalExchangeCode;
    oidc.verifyIdToken = originalVerifyIdToken;
    pool.query = originalQuery;
    delete process.env.OIDC_ISSUER_URL;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
    delete process.env.OIDC_REDIRECT_URI;
  }
});

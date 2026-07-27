// Generic OIDC relying-party flow (authorization code + PKCE) — works
// against any standards-compliant IdP, so the same code covers Okta, Azure
// AD, or anything else, configured purely via env vars (no vendor SDK).
const crypto = require('crypto');
const { signToken, verifyToken } = require('./jwt');

const discoveryCache = new Map();

async function discover(issuerUrl) {
  if (discoveryCache.has(issuerUrl)) return discoveryCache.get(issuerUrl);
  const res = await fetch(`${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const config = await res.json();
  discoveryCache.set(issuerUrl, config);
  return config;
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePkce() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function buildAuthorizationUrl({ authorizationEndpoint, clientId, redirectUri, state, codeChallenge, nonce }) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

// The OAuth `state` param IS the login ticket: a short-lived signed JWT
// carrying the PKCE verifier + nonce, so the callback needs no server-side
// session store to correlate them.
function signLoginTicket({ orgId, codeVerifier, nonce }) {
  return signToken({ orgId, codeVerifier, nonce, type: 'sso_login_ticket' }, { expiresIn: '10m' });
}

function verifyLoginTicket(state) {
  const payload = verifyToken(state);
  if (payload.type !== 'sso_login_ticket') throw new Error('invalid state ticket');
  return payload;
}

async function exchangeCode({ tokenEndpoint, clientId, clientSecret, code, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function verifyIdToken({ idToken, jwksUri, issuer, clientId }) {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  const { payload } = await jwtVerify(idToken, jwks, { issuer, audience: clientId });
  return payload;
}

module.exports = {
  discover,
  generatePkce,
  buildAuthorizationUrl,
  signLoginTicket,
  verifyLoginTicket,
  exchangeCode,
  verifyIdToken,
};

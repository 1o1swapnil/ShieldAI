const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { signToken } = require('../auth/jwt');
const oidc = require('../auth/oidc');

const router = express.Router();

function getProviderConfig() {
  const { OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI } = process.env;
  if (!OIDC_ISSUER_URL || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET || !OIDC_REDIRECT_URI) {
    throw new Error('OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI must be set');
  }
  return {
    issuerUrl: OIDC_ISSUER_URL,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    redirectUri: OIDC_REDIRECT_URI,
  };
}

// Works against Okta, Azure AD, or any OIDC-compliant IdP — configured
// entirely via env vars, no vendor-specific SDK.
router.get('/login', async (req, res) => {
  const { org_id } = req.query;
  if (!org_id) return res.status(400).json({ error: 'org_id is required' });

  try {
    const { issuerUrl, clientId, redirectUri } = getProviderConfig();
    const config = await oidc.discover(issuerUrl);
    const { codeVerifier, codeChallenge } = oidc.generatePkce();
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = oidc.signLoginTicket({ orgId: org_id, codeVerifier, nonce });

    res.redirect(
      oidc.buildAuthorizationUrl({
        authorizationEndpoint: config.authorization_endpoint,
        clientId,
        redirectUri,
        state,
        codeChallenge,
        nonce,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: 'code and state are required' });

  try {
    const ticket = oidc.verifyLoginTicket(state);
    const { issuerUrl, clientId, clientSecret, redirectUri } = getProviderConfig();
    const config = await oidc.discover(issuerUrl);

    const tokens = await oidc.exchangeCode({
      tokenEndpoint: config.token_endpoint,
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier: ticket.codeVerifier,
    });

    const claims = await oidc.verifyIdToken({
      idToken: tokens.id_token,
      jwksUri: config.jwks_uri,
      issuer: config.issuer,
      clientId,
    });

    if (claims.nonce !== ticket.nonce) {
      return res.status(401).json({ error: 'nonce mismatch' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id, org_id, email, role FROM users WHERE sso_issuer = $1 AND sso_subject = $2',
      [config.issuer, claims.sub]
    );

    let user = existing[0];
    if (!user) {
      // First SSO login for this identity: least-privilege 'employee' —
      // org admins are provisioned via /auth/register or promoted manually.
      // email_verified_at is set immediately: the IdP already proved
      // ownership as part of the org's own directory.
      const { rows } = await pool.query(
        `INSERT INTO users (org_id, email, role, auth_provider, sso_issuer, sso_subject, email_verified_at)
         VALUES ($1, $2, 'employee', 'sso', $3, $4, NOW())
         RETURNING id, org_id, email, role`,
        [ticket.orgId, claims.email || `${claims.sub}@sso.local`, config.issuer, claims.sub]
      );
      user = rows[0];
    }

    const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role });
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
    res.redirect(`${webOrigin}/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;

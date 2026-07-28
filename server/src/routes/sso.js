const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { signToken } = require('../auth/jwt');
const { createSession } = require('../auth/sessions');
const oidc = require('../auth/oidc');
const { normalizeEmail } = require('../email');

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
      //
      // The IdP is a single shared deployment-wide config, not per-org, so
      // org_id here is just whatever the caller passed to /login — anyone
      // who can complete a real login could otherwise auto-provision into
      // any org whose UUID they can see (e.g. printed in the web console).
      // Gate first-time provisioning on the org already having a member
      // with a matching email domain, so a new SSO identity can only land
      // in an org it plausibly belongs to. Without a real email claim
      // there's nothing to domain-match against — a constant fallback
      // domain (e.g. "sso.local") would let any other no-email identity
      // from the same shared IdP piggyback into an org that already has
      // one such user, so refuse outright instead of falling back.
      if (!claims.email) {
        return res.status(403).json({ error: 'SSO auto-provisioning requires an email claim from the identity provider' });
      }
      const email = normalizeEmail(claims.email);
      const domain = email.split('@')[1];
      const { rows: domainMatch } = await pool.query(
        `SELECT 1 FROM users WHERE org_id = $1 AND LOWER(SPLIT_PART(email, '@', 2)) = $2 LIMIT 1`,
        [ticket.orgId, domain]
      );
      if (!domainMatch.length) {
        return res.status(403).json({ error: 'SSO auto-provisioning is not permitted for this organization' });
      }

      const { rows } = await pool.query(
        `INSERT INTO users (org_id, email, role, auth_provider, sso_issuer, sso_subject, email_verified_at)
         VALUES ($1, $2, 'employee', 'sso', $3, $4, NOW())
         RETURNING id, org_id, email, role`,
        [ticket.orgId, email, config.issuer, claims.sub]
      );
      user = rows[0];
    }

    const sid = await createSession(pool, { userId: user.id, orgId: user.org_id });
    const token = signToken({ sub: user.id, sid, orgId: user.org_id, role: user.role });
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
    res.redirect(`${webOrigin}/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;

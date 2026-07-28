const pool = require('../db');
const { verifyToken } = require('./jwt');

// Checks live revocation status against the DB on every request, same
// pattern as device tokens — the JWT's own 24h expiry is a backstop, the
// sessions row is the real kill switch. Any token minted before this
// change has no matching session row and is correctly treated as revoked.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
  if (payload.type) {
    return res.status(401).json({ error: 'not a user session token' });
  }

  const { rows } = await pool.query('SELECT revoked_at FROM sessions WHERE id = $1', [payload.sid]);
  if (!rows.length || rows[0].revoked_at) {
    return res.status(401).json({ error: 'session revoked or not found' });
  }

  req.user = payload; // { sub, sid, orgId, role, iat, exp }
  pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [payload.sid]).catch(() => {});
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin role required' });
  next();
}

// getOrgId(req) => the org id this request is trying to act on. Defaults to
// req.params.orgId. 403s if it doesn't match the authenticated user's org —
// closes the "any org_id the client sends is trusted" gap. A request that
// omits org_id entirely gets 400, not 403 — it's not making an authorization
// claim at all, so "org mismatch" would be a misleading response.
function requireOrgMatch(getOrgId = (req) => req.params.orgId) {
  return (req, res, next) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'org_id is required' });
    if (orgId !== req.user?.orgId) {
      return res.status(403).json({ error: 'org mismatch' });
    }
    next();
  };
}

module.exports = { requireAuth, requireAdmin, requireOrgMatch };

const { verifyToken } = require('./jwt');

function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  try {
    req.user = verifyToken(token); // { sub, orgId, role }
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin role required' });
  next();
}

// getOrgId(req) => the org id this request is trying to act on. Defaults to
// req.params.orgId. 403s if it doesn't match the authenticated user's org —
// closes the "any org_id the client sends is trusted" gap.
function requireOrgMatch(getOrgId = (req) => req.params.orgId) {
  return (req, res, next) => {
    if (getOrgId(req) !== req.user?.orgId) {
      return res.status(403).json({ error: 'org mismatch' });
    }
    next();
  };
}

module.exports = { requireAuth, requireAdmin, requireOrgMatch };

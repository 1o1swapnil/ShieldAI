const pool = require('../db');
const { verifyToken } = require('./jwt');

// Verifies a device token AND checks live revocation status against the DB
// on every request — the JWT alone is long-lived (400d), so `devices.revoked_at`
// is the real kill switch, not the token's own expiry.
async function requireDeviceAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing bearer device token' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'invalid or expired device token' });
  }
  if (payload.type !== 'device') {
    return res.status(401).json({ error: 'not a device token' });
  }

  const { rows } = await pool.query('SELECT id, org_id, user_id, revoked_at FROM devices WHERE id = $1', [
    payload.sub,
  ]);
  if (!rows.length || rows[0].revoked_at) {
    return res.status(401).json({ error: 'device revoked or not found' });
  }

  req.device = { id: rows[0].id, orgId: rows[0].org_id, userId: rows[0].user_id };
  pool.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});
  next();
}

module.exports = { requireDeviceAuth };

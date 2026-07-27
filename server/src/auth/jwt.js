const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// No JWT_SECRET configured -> generate a random one for this process. Fails
// safe (sessions invalidate on restart) instead of running with a
// predictable or hardcoded secret.
let devSecret = null;
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
    console.warn('JWT_SECRET not set — using an ephemeral per-process secret. Set JWT_SECRET in production.');
  }
  return devSecret;
}

function signToken(payload, options = {}) {
  return jwt.sign(payload, getSecret(), { expiresIn: '24h', ...options });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };

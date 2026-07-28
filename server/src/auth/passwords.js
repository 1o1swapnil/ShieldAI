// Stdlib scrypt instead of adding a bcrypt dependency — Node's own crypto
// docs recommend scrypt for password hashing.
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const suppliedBuffer = crypto.scryptSync(password, salt, 64);
  return hashBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(hashBuffer, suppliedBuffer);
}

// A short, non-reversible fingerprint of the current password_hash,
// embedded in a password-reset ticket so it's single-use: once the
// password actually changes, the fingerprint stops matching and a
// replayed ticket (e.g. an old reset email dug up later) is rejected —
// no separate "used tickets" table needed.
function fingerprintPasswordHash(hash) {
  return crypto.createHash('sha256').update(hash || '').digest('hex').slice(0, 16);
}

module.exports = { hashPassword, verifyPassword, fingerprintPasswordHash };

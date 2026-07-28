const express = require('express');
const pool = require('../db');
const { isVerifiedBuild } = require('../buildVerify');
const { signToken, verifyToken } = require('../auth/jwt');
const { requireDeviceAuth } = require('../auth/deviceMiddleware');
const { sendVerificationEmail } = require('../email');

const router = express.Router();

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

function issueDeviceToken(deviceId, orgId, userId) {
  return signToken({ sub: deviceId, orgId, userId, type: 'device' }, { expiresIn: '400d' });
}

// Device-token bootstrap: exchanges an admin-issued install token (once)
// for a long-lived, individually revocable device token. No prior auth
// needed here — the install token IS the credential.
//
// A brand-new or not-yet-verified email doesn't get a device token yet —
// only a polling ticket. The token is only minted once the emailed
// verification link is actually clicked (POST /extension/verify-device),
// proving whoever registered the device controls that inbox. A returning
// user whose email is already verified skips this — no need to re-prove
// ownership on every reinstall.
router.post('/register-device', async (req, res) => {
  const { install_token, email } = req.body || {};
  if (!install_token || !email) {
    return res.status(400).json({ error: 'install_token and email are required' });
  }

  const { rows: tokenRows } = await pool.query(
    'SELECT id, org_id FROM install_tokens WHERE token = $1 AND revoked_at IS NULL',
    [install_token]
  );
  if (!tokenRows.length) return res.status(401).json({ error: 'invalid or revoked install token' });
  const { id: installTokenId, org_id: orgId } = tokenRows[0];

  const { rows: userRows } = await pool.query('SELECT id, email_verified_at FROM users WHERE email = $1', [email]);
  const alreadyVerified = Boolean(userRows[0]?.email_verified_at);

  // Transactional: if the verification email fails to send, roll back the
  // user/device rows entirely instead of leaving an orphaned unverified
  // device behind (same class of bug as /auth/register — fix once, same
  // pattern).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let userId = userRows[0]?.id;
    if (!userId) {
      const { rows: created } = await client.query(
        `INSERT INTO users (org_id, email, role, auth_provider) VALUES ($1, $2, 'employee', 'device') RETURNING id`,
        [orgId, email]
      );
      userId = created[0].id;
    }

    if (alreadyVerified) {
      const { rows: deviceRows } = await client.query(
        `INSERT INTO devices (org_id, user_id, install_token_id, verified_at) VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [orgId, userId, installTokenId]
      );
      await client.query('COMMIT');
      return res
        .status(201)
        .json({ device_token: issueDeviceToken(deviceRows[0].id, orgId, userId), org_id: orgId, user_id: userId });
    }

    const { rows: deviceRows } = await client.query(
      `INSERT INTO devices (org_id, user_id, install_token_id) VALUES ($1, $2, $3) RETURNING id`,
      [orgId, userId, installTokenId]
    );
    const deviceId = deviceRows[0].id;

    const ticket = signToken({ sub: deviceId, type: 'device_verification' }, { expiresIn: '1h' });
    await sendVerificationEmail(email, `${WEB_ORIGIN}/?device_ticket=${encodeURIComponent(ticket)}`);

    await client.query('COMMIT');
    res.status(201).json({ pending: true, ticket, message: `Check ${email} for a verification link.` });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// The link the verification email points to (opened in a normal browser
// tab, not the extension) — flips the device (and the user's email,
// org-wide) to verified.
router.post('/verify-device', async (req, res) => {
  const { ticket } = req.body || {};
  if (!ticket) return res.status(400).json({ error: 'ticket is required' });

  let payload;
  try {
    payload = verifyToken(ticket);
  } catch {
    return res.status(401).json({ error: 'invalid or expired verification link' });
  }
  if (payload.type !== 'device_verification') {
    return res.status(401).json({ error: 'not a device verification ticket' });
  }

  const { rows } = await pool.query(
    `UPDATE devices SET verified_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING user_id`,
    [payload.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'device not found or revoked' });

  await pool.query(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1`, [
    rows[0].user_id,
  ]);

  res.json({ verified: true });
});

// Polled by the extension after register-device returns {pending: true}.
// Only returns a device token once the human actually clicked the emailed
// link — possessing the polling ticket alone never unlocks it.
router.get('/device-status', async (req, res) => {
  const { ticket } = req.query;
  if (!ticket) return res.status(400).json({ error: 'ticket is required' });

  let payload;
  try {
    payload = verifyToken(ticket);
  } catch {
    return res.status(401).json({ error: 'invalid or expired ticket' });
  }
  if (payload.type !== 'device_verification') {
    return res.status(401).json({ error: 'not a device verification ticket' });
  }

  const { rows } = await pool.query('SELECT org_id, user_id, verified_at FROM devices WHERE id = $1', [payload.sub]);
  if (!rows.length) return res.status(404).json({ error: 'device not found' });
  if (!rows[0].verified_at) return res.json({ pending: true });

  res.json({
    device_token: issueDeviceToken(payload.sub, rows[0].org_id, rows[0].user_id),
    org_id: rows[0].org_id,
    user_id: rows[0].user_id,
  });
});

// 3.3: service worker self-reports its build on every poll. org_id/user_id
// come from the device token now, not the request body.
router.post('/config', requireDeviceAuth, async (req, res) => {
  const { version, build_hash, optional_host_permission_granted } = req.body || {};
  if (!version || !build_hash) {
    return res.status(400).json({ error: 'version and build_hash are required' });
  }

  const { rows } = await pool.query('SELECT build_hash FROM extension_builds WHERE version = $1', [version]);
  const verified = isVerifiedBuild(rows[0], build_hash);

  await pool.query(
    `INSERT INTO extension_installs (org_id, user_id, extension_version, build_hash, optional_host_permission_granted, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (org_id, user_id) DO UPDATE SET
       extension_version = EXCLUDED.extension_version,
       build_hash = EXCLUDED.build_hash,
       optional_host_permission_granted = EXCLUDED.optional_host_permission_granted,
       last_seen_at = NOW()`,
    [req.device.orgId, req.device.userId, version, build_hash, Boolean(optional_host_permission_granted)]
  );

  res.json({ verified });
});

module.exports = router;

// Hits a real, running server + real Postgres end to end: register (the
// transactional org+user+email path) -> verify -> login -> an authenticated,
// org-scoped request -> a CORS check. Unit tests stub pool.query, so this is
// the only thing that would catch a regression in the transactional-
// registration commit/rollback path or the chrome-extension CORS allowlist.
// Run via `node scripts/smoke-test.js` against a server already listening on
// API_BASE, with SERVER_LOG_FILE pointing at its captured stdout (no SMTP
// configured -> verification emails are logged there instead of sent).
const fs = require('fs');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const LOG_FILE = process.env.SERVER_LOG_FILE;

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function waitForHealth(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.status === 200) return;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('server never became healthy');
}

// Same link a real user would click, read off the dev-mailer console log
// (server/src/email.js) instead of an inbox. The logged message body spans
// several lines, so grab a chunk after the marker rather than one line.
function readVerificationTicket(email) {
  const log = fs.readFileSync(LOG_FILE, 'utf8');
  const marker = `[dev-mailer] Verify your ShieldAI email for ${email}:`;
  const idx = log.lastIndexOf(marker);
  assert(idx !== -1, `no dev-mailer log entry found for ${email}`);
  const match = log.slice(idx, idx + 2000).match(/ticket=([^&\s]+)/);
  assert(match, 'no ticket found in dev-mailer log entry');
  return decodeURIComponent(match[1]);
}

async function main() {
  await waitForHealth();

  const email = `smoke-${Date.now()}@example.com`;
  const password = 'smoke-test-password-1';

  let res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_name: `Smoke Test Org ${Date.now()}`, email, password }),
  });
  assert(res.status === 201, `register expected 201, got ${res.status}`);
  assert((await res.json()).pending === true, 'register response missing pending:true');

  // Unverified accounts must not be able to log in yet.
  res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert(res.status === 403, `pre-verification login expected 403, got ${res.status}`);

  const ticket = readVerificationTicket(email);
  res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  assert(res.status === 200, `verify-email expected 200, got ${res.status}`);
  const { user } = await res.json();

  res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert(res.status === 200, `login expected 200, got ${res.status}`);
  const { token } = await res.json();
  assert(token, 'login response missing token');

  res = await fetch(`${API_BASE}/org/${user.org_id}/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.status === 200, `authenticated org-scoped request expected 200, got ${res.status}`);

  // The extension's own pages must be let through regardless of WEB_ORIGIN.
  res = await fetch(`${API_BASE}/health`, {
    headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnopabcd' },
  });
  assert(
    res.headers.get('access-control-allow-origin') === 'chrome-extension://abcdefghijklmnopabcdefghijklmnopabcd',
    'chrome-extension origin was not reflected by CORS'
  );

  console.log('smoke test passed');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

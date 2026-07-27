// 4.1: Monitoring Notice screen, shown before device registration.
const API_BASE = 'http://localhost:3000'; // TODO: point at the deployed ShieldAI API
const POLL_INTERVAL_MS = 4000;

const params = new URLSearchParams(window.location.search);
const installToken = params.get('install_token');
const policyUrl = params.get('policy_url');

const noticeTextEl = document.getElementById('notice-text');
const policyLinkEl = document.getElementById('policy-link');
const emailInput = document.getElementById('email-input');
const checkbox = document.getElementById('ack-checkbox');
const ackButton = document.getElementById('ack-button');
const statusEl = document.getElementById('status');

if (params.get('email')) emailInput.value = params.get('email');

if (policyUrl) {
  policyLinkEl.href = policyUrl;
} else {
  policyLinkEl.parentElement.style.display = 'none';
}

if (!installToken) {
  statusEl.textContent = 'Missing install link. Ask your admin for a valid ShieldAI install link.';
}

let noticeVersion = null;

fetch(`${API_BASE}/consent/notice`)
  .then((r) => r.json())
  .then((data) => {
    noticeVersion = data.version;
    noticeTextEl.textContent = data.text;
  })
  .catch(() => {
    noticeTextEl.textContent = 'Could not load the notice. Reload this page before continuing.';
  });

function updateButtonState() {
  ackButton.disabled = !(checkbox.checked && emailInput.value && installToken);
}
checkbox.addEventListener('change', updateButtonState);
emailInput.addEventListener('input', updateButtonState);

// Logs the consent ack and moves on to the permission-request screen —
// only reachable once a real device token exists (i.e. the email was
// actually verified, or this is a returning already-verified user).
async function finishRegistration(deviceToken, orgId, userId) {
  await chrome.runtime.sendMessage({ type: 'device-registered', deviceToken, orgId, userId });

  const ackRes = await fetch(`${API_BASE}/consent/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ notice_version: noticeVersion }),
  });
  if (!ackRes.ok) throw new Error(await ackRes.text());

  await chrome.runtime.sendMessage({ type: 'consent-acknowledged', noticeVersion });

  statusEl.textContent = 'Acknowledged. Continuing…';
  window.location.href = 'permission-request.html';
}

function pollForVerification(ticket) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/extension/device-status?ticket=${encodeURIComponent(ticket)}`);
      if (!res.ok) return; // keep polling — link may just not be clicked yet
      const data = await res.json();
      if (data.pending) return;

      clearInterval(interval);
      await finishRegistration(data.device_token, data.org_id, data.user_id);
    } catch {
      // transient network error — keep polling
    }
  }, POLL_INTERVAL_MS);
}

ackButton.addEventListener('click', async () => {
  ackButton.disabled = true;
  try {
    // Exchange the install token for a device identity (Section 7 gap
    // fix). A new/unverified email doesn't get a device token yet — only
    // a polling ticket, until the emailed verification link is clicked.
    const regRes = await fetch(`${API_BASE}/extension/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ install_token: installToken, email: emailInput.value }),
    });
    if (!regRes.ok) throw new Error(await regRes.text());
    const data = await regRes.json();

    if (data.pending) {
      statusEl.textContent = data.message || 'Check your email to verify, then keep this tab open.';
      pollForVerification(data.ticket);
      return;
    }

    await finishRegistration(data.device_token, data.org_id, data.user_id);
  } catch (err) {
    statusEl.textContent = 'Something went wrong. Please try again.';
    ackButton.disabled = false;
  }
});

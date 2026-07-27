// 4.1: Monitoring Notice screen, shown before device registration.
const API_BASE = 'http://localhost:3000'; // TODO: point at the deployed ShieldAI API

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

ackButton.addEventListener('click', async () => {
  ackButton.disabled = true;
  try {
    // Exchange the install token for a long-lived, revocable device token —
    // this device's identity for every subsequent call (Section 7 gap fix).
    const regRes = await fetch(`${API_BASE}/extension/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ install_token: installToken, email: emailInput.value }),
    });
    if (!regRes.ok) throw new Error(await regRes.text());
    const { device_token: deviceToken, org_id: orgId, user_id: userId } = await regRes.json();

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
  } catch (err) {
    statusEl.textContent = 'Something went wrong. Please try again.';
    ackButton.disabled = false;
  }
});

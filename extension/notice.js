// 4.1: Monitoring Notice screen, shown before the install-token step.
const API_BASE = 'http://localhost:3000'; // TODO: point at the deployed ShieldAI API

const params = new URLSearchParams(window.location.search);
const orgId = params.get('org_id');
const userId = params.get('user_id');
const policyUrl = params.get('policy_url');

const noticeTextEl = document.getElementById('notice-text');
const policyLinkEl = document.getElementById('policy-link');
const checkbox = document.getElementById('ack-checkbox');
const ackButton = document.getElementById('ack-button');
const statusEl = document.getElementById('status');

if (policyUrl) {
  policyLinkEl.href = policyUrl;
} else {
  policyLinkEl.parentElement.style.display = 'none';
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

checkbox.addEventListener('change', () => {
  ackButton.disabled = !checkbox.checked;
});

ackButton.addEventListener('click', async () => {
  ackButton.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/consent/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, org_id: orgId, notice_version: noticeVersion }),
    });
    if (!res.ok) throw new Error(await res.text());

    await chrome.runtime.sendMessage({ type: 'consent-acknowledged', noticeVersion, orgId, userId });

    statusEl.textContent = 'Acknowledged. Continuing…';
    window.location.href = `permission-request.html?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`;
  } catch (err) {
    statusEl.textContent = 'Something went wrong. Please try again.';
    ackButton.disabled = false;
  }
});

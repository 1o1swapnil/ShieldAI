const API_BASE = 'http://localhost:3000'; // TODO: point at the deployed ShieldAI API
const POLL_ALARM = 'shieldai-config-poll';

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('notice.html') });
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 60 });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'consent-acknowledged') {
    chrome.storage.local.set(
      { consentAcknowledged: true, noticeVersion: message.noticeVersion, orgId: message.orgId, userId: message.userId },
      () => sendResponse({ ok: true })
    );
    return true; // keep the message channel open for the async sendResponse
  }
  if (message.type === 'host-permission-decision') {
    chrome.storage.local.set({ optionalHostPermissionGranted: message.granted }, () => {
      sendResponse({ ok: true });
      reportConfig();
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) reportConfig();
});

// 3.3: self-report this install's build so the org's security team can
// verify (via GET /org/:orgId/extension-versions) it matches a reviewed build.
async function reportConfig() {
  const { orgId, userId, optionalHostPermissionGranted } = await chrome.storage.local.get([
    'orgId',
    'userId',
    'optionalHostPermissionGranted',
  ]);
  if (!orgId || !userId) return;

  const { version, build_hash } = await fetch(chrome.runtime.getURL('build-info.json')).then((r) => r.json());

  const res = await fetch(`${API_BASE}/extension/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: orgId,
      user_id: userId,
      version,
      build_hash,
      optional_host_permission_granted: Boolean(optionalHostPermissionGranted),
    }),
  });
  const { verified } = await res.json();
  chrome.storage.local.set({ buildVerified: verified });
}

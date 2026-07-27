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
      if (message.granted) registerUnknownDomainScan();
    });
    return true;
  }
  if (message.type === 'page-visit') {
    reportPageVisit(message, sender.tab && sender.tab.id);
    return false;
  }
});

// 3.1: only scan domains outside the known-tool list once the user granted
// the optional <all_urls> permission — the known-150 list is already
// covered by the static content_scripts entry in manifest.json.
function registerUnknownDomainScan() {
  chrome.scripting.registerContentScripts([
    {
      id: 'shieldai-unknown-domain-scan',
      matches: ['<all_urls>'],
      js: ['content.js'],
      runAt: 'document_idle',
    },
  ]).catch(() => {}); // already registered on a prior grant
}

// Section 8: forward the content script's single DOM read to the real
// activity-ingestion endpoint. One tab = one session for duration purposes.
async function reportPageVisit(message, tabId) {
  const { orgId, userId } = await chrome.storage.local.get(['orgId', 'userId']);
  if (!orgId || !userId) return;

  await fetch(`${API_BASE}/activity/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: orgId,
      user_id: userId,
      domain: message.domain,
      title: message.title,
      script_hints: message.scriptHints,
      session_id: tabId != null ? `tab-${tabId}` : null,
    }),
  }).catch(() => {}); // best-effort; a dropped event isn't worth retry complexity here
}

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

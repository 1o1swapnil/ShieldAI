// Source-of-truth for the employee monitoring notice (Section 4.1) and the
// jurisdiction checklist templates (Section 4.2). Bump NOTICE_VERSION any
// time the text changes materially — consent_log rows record the version
// the employee actually saw.

const NOTICE_VERSION = 'v1';

const NOTICE_TEXT = `ShieldAI monitors AI tool usage on this device on behalf of your employer.

What is collected: the hostname and path of URLs you visit that match a known
AI tool, the tool name, and timestamps.

What is NOT collected: page content, text you type, or AI prompts/responses.

Who can see it: your organization's ShieldAI administrators, per your
employer's data retention policy.

See your organization's DPA/policy for full details.`;

// Sourced language, not legal advice. Admins can override per jurisdiction
// via organizations.checklist_overrides.
const JURISDICTION_CHECKLISTS = {
  'EU-DE': [
    'Works council consultation may be required before enabling monitoring (Betriebsrat, §87 BetrVG)',
    'GDPR Art. 13/14 transparency notice must be provided to employees',
  ],
  'US-CT': [
    'Connecticut General Statutes §31-48d requires prior written notice of electronic monitoring',
  ],
  'US-DE': [
    'Delaware Code Title 19 §705 requires notice of electronic monitoring',
  ],
  'US-NY': [
    'New York Civil Rights Law §52-c requires notice of electronic monitoring at hiring and posted notice',
  ],
  DEFAULT: [
    'Review local labor law / works council requirements before enabling monitoring',
  ],
};

function checklistFor(jurisdictions, overrides = {}) {
  const codes = jurisdictions && jurisdictions.length ? jurisdictions : ['DEFAULT'];
  return codes.map((code) => ({
    jurisdiction: code,
    items: overrides[code] || JURISDICTION_CHECKLISTS[code] || JURISDICTION_CHECKLISTS.DEFAULT,
  }));
}

// 4.2: incognito monitoring and the native-app companion stay off until the
// org has configured at least one jurisdiction.
function noticeConfigured(jurisdictions) {
  return Array.isArray(jurisdictions) && jurisdictions.length > 0;
}

module.exports = {
  NOTICE_VERSION,
  NOTICE_TEXT,
  JURISDICTION_CHECKLISTS,
  checklistFor,
  noticeConfigured,
};

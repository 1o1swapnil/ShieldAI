// 2.2: technology fingerprint — Wappalyzer-style passive signature match
// against known AI SDK/widget script embeds. Illustrative seed list; grows
// the same way a real signature database does, as new tools get confirmed
// through the review queue.
const KNOWN_AI_WIDGET_SIGNATURES = ['chatbase.co', 'ada.support', 'copilot-widget', 'openai-chat-widget'];

function fingerprintFeature(scriptHints = []) {
  const lower = scriptHints.map((s) => s.toLowerCase());
  const matched = KNOWN_AI_WIDGET_SIGNATURES.filter((sig) => lower.some((hint) => hint.includes(sig)));
  return { matched, score: matched.length ? 20 : 0 };
}

module.exports = { KNOWN_AI_WIDGET_SIGNATURES, fingerprintFeature };

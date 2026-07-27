// 1.1: revised, honest product language — replaces "complete visibility."
const COVERAGE_INTRO_TEXT =
  'ShieldAI provides governance-grade visibility into browser-based AI tool usage — the largest and ' +
  'fastest-growing share of Shadow AI — with optional network and SSO-log layers to extend coverage to ' +
  'non-browser and non-managed-device usage. No single vendor can see 100% of AI usage; ShieldAI is ' +
  'explicit with customers about which layer covers which channel.';

// 1.2: the Coverage Map. Status is computed per-org for the rows we can
// actually measure; the BYOD and self-hosted rows are honest static facts,
// not something a toggle could ever turn "covered."
function buildCoverageMap({
  extensionInstallCount = 0,
  dnsProxyConfigured = false,
  nativeAppCompanionEnabled = false,
  discoveredIntegrationsCount = 0,
} = {}) {
  return [
    {
      channel: 'Browser (managed device, extension installed)',
      detection_layer: 'Extension — real-time, high confidence',
      requires: 'Extension deployed',
      status: extensionInstallCount > 0 ? 'covered' : 'not_covered',
    },
    {
      channel: 'Browser (managed device, no extension)',
      detection_layer: 'DNS/proxy log ingestion',
      requires: "Customer's DNS/proxy forwarding configured",
      status: dnsProxyConfigured ? 'covered' : 'not_covered',
    },
    {
      channel: 'Browser (unmanaged/BYOD)',
      detection_layer: 'Not covered — flagged as a known gap',
      requires: '—',
      status: 'not_covered',
    },
    {
      channel: 'Native desktop AI apps (e.g., ChatGPT desktop, Claude desktop)',
      detection_layer: 'Process-name + network-egress detection',
      requires: 'Native-app companion enabled (opt-in, separate toggle)',
      status: nativeAppCompanionEnabled ? 'covered' : 'not_covered',
    },
    {
      channel: 'API-based internal integrations',
      detection_layer: 'OAuth/API-key discovery via SSO + expense/vendor data',
      requires: 'SSO connector + optional finance system connector',
      status: discoveredIntegrationsCount > 0 ? 'partial' : 'not_covered',
    },
    {
      channel: 'Self-hosted/internal LLM endpoints',
      detection_layer: 'Not detectable by domain matching — requires manual registration',
      requires: 'Admin adds internal tool entries to ai_tools',
      status: 'manual',
    },
  ];
}

module.exports = { COVERAGE_INTRO_TEXT, buildCoverageMap };

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCoverageMap } = require('../src/coverageMap');
const { fuzzyMatchAiTool } = require('../src/fuzzyMatch');

test('buildCoverageMap always reports 6 channels', () => {
  assert.equal(buildCoverageMap().length, 6);
});

test('BYOD browser channel is always not_covered, regardless of input', () => {
  const rows = buildCoverageMap({ extensionInstallCount: 100, dnsProxyConfigured: true, nativeAppCompanionEnabled: true });
  const byod = rows.find((r) => r.channel === 'Browser (unmanaged/BYOD)');
  assert.equal(byod.status, 'not_covered');
});

test('self-hosted LLM channel is always manual, never claimed covered', () => {
  const rows = buildCoverageMap();
  const selfHosted = rows.find((r) => r.channel === 'Self-hosted/internal LLM endpoints');
  assert.equal(selfHosted.status, 'manual');
});

test('extension and native-app rows flip to covered only when the signal is present', () => {
  const uncovered = buildCoverageMap();
  assert.equal(uncovered[0].status, 'not_covered');
  const covered = buildCoverageMap({ extensionInstallCount: 1, nativeAppCompanionEnabled: true });
  assert.equal(covered[0].status, 'covered');
  assert.equal(covered.find((r) => r.channel.startsWith('Native desktop')).status, 'covered');
});

test('API integrations channel is at most partial, never fully covered', () => {
  const rows = buildCoverageMap({ discoveredIntegrationsCount: 50 });
  assert.equal(rows.find((r) => r.channel === 'API-based internal integrations').status, 'partial');
});

test('fuzzyMatchAiTool matches an OAuth grant name against the ai_tools library', () => {
  const tools = [{ id: '1', name: 'ChatGPT', domain: 'chatgpt.com' }, { id: '2', name: 'Claude', domain: 'claude.ai' }];
  assert.equal(fuzzyMatchAiTool('OpenAI API access', tools), null);
  assert.equal(fuzzyMatchAiTool('ChatGPT Enterprise', tools), '1');
  assert.equal(fuzzyMatchAiTool('chatgpt.com integration', tools), '1');
});

test('fuzzyMatchAiTool returns null for empty input', () => {
  assert.equal(fuzzyMatchAiTool('', [{ id: '1', name: 'ChatGPT', domain: 'chatgpt.com' }]), null);
});

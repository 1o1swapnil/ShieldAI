const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../seeds/ai_tools.json');

test('seed library has at least 150 tools', () => {
  assert.ok(tools.length >= 150, `expected >=150, got ${tools.length}`);
});

test('every domain is unique', () => {
  const domains = tools.map((t) => t.domain);
  assert.equal(new Set(domains).size, domains.length);
});

test('every entry has a non-empty name, domain, and category', () => {
  for (const tool of tools) {
    assert.ok(tool.name && tool.name.trim(), `missing name for ${JSON.stringify(tool)}`);
    assert.ok(tool.domain && tool.domain.trim(), `missing domain for ${JSON.stringify(tool)}`);
    assert.ok(tool.category && tool.category.trim(), `missing category for ${JSON.stringify(tool)}`);
  }
});

test('no domain includes a scheme or path (bare hostname only)', () => {
  for (const tool of tools) {
    assert.ok(!/^https?:\/\//.test(tool.domain), `domain should be bare hostname: ${tool.domain}`);
    assert.ok(!tool.domain.includes('/'), `domain should be bare hostname: ${tool.domain}`);
  }
});

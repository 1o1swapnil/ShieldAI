const test = require('node:test');
const assert = require('node:assert/strict');
const { noticeConfigured, checklistFor, NOTICE_VERSION } = require('../src/notice');

test('noticeConfigured is false until a jurisdiction is set', () => {
  assert.equal(noticeConfigured([]), false);
  assert.equal(noticeConfigured(undefined), false);
  assert.equal(noticeConfigured(['US-CT']), true);
});

test('checklistFor falls back to DEFAULT when no jurisdiction configured', () => {
  const result = checklistFor([]);
  assert.equal(result.length, 1);
  assert.equal(result[0].jurisdiction, 'DEFAULT');
});

test('checklistFor honors admin overrides per jurisdiction', () => {
  const result = checklistFor(['US-CT'], { 'US-CT': ['custom item'] });
  assert.deepEqual(result, [{ jurisdiction: 'US-CT', items: ['custom item'] }]);
});

test('NOTICE_VERSION is a non-empty string', () => {
  assert.equal(typeof NOTICE_VERSION, 'string');
  assert.ok(NOTICE_VERSION.length > 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { domainTokenFeature, titleTokenFeature } = require('../src/classifier/textSignals');
const { fingerprintFeature } = require('../src/classifier/fingerprint');
const { certFeature } = require('../src/classifier/certFeature');
const { registrationAgeFeature } = require('../src/classifier/registrationAgeFeature');
const { aggregateFeature } = require('../src/classifier/aggregate');
const { scoreFeatures, defaultActionFor, explain } = require('../src/classifier/score');

test('domainTokenFeature matches known AI naming conventions', () => {
  assert.deepEqual(domainTokenFeature('chat-ai-assistant.com').matched.sort(), ['ai', 'assistant', 'chat']);
  assert.equal(domainTokenFeature('example.com').score, 0);
});

test('titleTokenFeature scores strong AI-sounding titles', () => {
  const result = titleTokenFeature('AI Writing Assistant');
  assert.ok(result.score > 0);
  assert.ok(result.matched.includes('ai'));
});

test('fingerprintFeature only matches known signatures', () => {
  assert.equal(fingerprintFeature(['https://chatbase.co/widget.js']).score, 20);
  assert.equal(fingerprintFeature(['https://fonts.googleapis.com/foo']).score, 0);
});

test('certFeature flags known AI-adjacent providers', () => {
  assert.equal(certFeature('Cloudflare, Inc.').knownProvider, true);
  assert.equal(certFeature('Sectigo Limited').knownProvider, false);
  assert.equal(certFeature(null).knownProvider, false);
});

test('registrationAgeFeature rewards young domains, ignores unknown age', () => {
  assert.equal(registrationAgeFeature(30).score, 5);
  assert.equal(registrationAgeFeature(3000).score, 0);
  assert.equal(registrationAgeFeature(null).score, 0);
});

test('aggregateFeature rewards multi-user short-burst usage', () => {
  assert.equal(aggregateFeature({ distinctUsers: 5, avgSessionSeconds: 60 }).score, 10);
  assert.equal(aggregateFeature({ distinctUsers: 1, avgSessionSeconds: 3600 }).score, 0);
});

function snapshot(overrides = {}) {
  return {
    domain: 'chat-ai.example',
    titleText: 'AI Writing Assistant',
    domainTokens: domainTokenFeature('chat-ai.example'),
    titleTokens: titleTokenFeature('AI Writing Assistant'),
    fingerprint: fingerprintFeature(['https://chatbase.co/widget.js']),
    cert: certFeature('Cloudflare, Inc.'),
    registrationAge: registrationAgeFeature(120),
    aggregate: aggregateFeature({ distinctUsers: 5, avgSessionSeconds: 60 }),
    ...overrides,
  };
}

test('scoreFeatures combines all signals and caps at 100', () => {
  const confidence = scoreFeatures(snapshot());
  assert.ok(confidence > 85);
  assert.ok(confidence <= 100);
});

test('defaultActionFor follows the 2.3 thresholds', () => {
  assert.equal(defaultActionFor(90), 'warn');
  assert.equal(defaultActionFor(70), 'allow_silent_log');
  assert.equal(defaultActionFor(59), null);
});

test('explain surfaces at most 3 plain-language reasons, strongest first', () => {
  const reasons = explain(snapshot());
  assert.ok(reasons.length <= 3);
  assert.ok(reasons[0].includes('chat-ai.example') || reasons[0].includes('AI Writing Assistant'));
});

test('explain returns nothing when no feature matched', () => {
  const quiet = snapshot({
    domainTokens: domainTokenFeature('example.com'),
    titleTokens: titleTokenFeature(''),
    fingerprint: fingerprintFeature([]),
    cert: certFeature(null),
    registrationAge: registrationAgeFeature(null),
    aggregate: aggregateFeature({}),
  });
  assert.deepEqual(explain(quiet), []);
});

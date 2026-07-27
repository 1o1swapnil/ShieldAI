const test = require('node:test');
const assert = require('node:assert/strict');
const { isVerifiedBuild } = require('../src/buildVerify');

test('verified when reported hash matches the reviewed build', () => {
  assert.equal(isVerifiedBuild({ build_hash: 'abc' }, 'abc'), true);
});

test('not verified when hash differs (tampered or unofficial build)', () => {
  assert.equal(isVerifiedBuild({ build_hash: 'abc' }, 'def'), false);
});

test('not verified when the version was never released', () => {
  assert.equal(isVerifiedBuild(undefined, 'abc'), false);
  assert.equal(isVerifiedBuild(null, 'abc'), false);
});

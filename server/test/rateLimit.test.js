const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/rateLimit');

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

test('allows up to max requests, then blocks with 429', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, keyGenerator: () => 'k', clock: () => now });

  let allowed = 0;
  for (let i = 0; i < 3; i++) {
    const res = fakeRes();
    limiter({}, res, () => allowed++);
    if (i === 2) {
      assert.equal(res.statusCode, 429);
      assert.ok(res.headers['Retry-After']);
    }
  }
  assert.equal(allowed, 2);
});

test('resets after the window elapses', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyGenerator: () => 'k', clock: () => now });

  let allowed = 0;
  limiter({}, fakeRes(), () => allowed++);
  const blockedRes = fakeRes();
  limiter({}, blockedRes, () => allowed++);
  assert.equal(blockedRes.statusCode, 429);

  now = 1001; // past the window
  limiter({}, fakeRes(), () => allowed++);
  assert.equal(allowed, 2);
});

test('tracks separate keys independently', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyGenerator: (req) => req.key, clock: () => now });

  let allowed = 0;
  limiter({ key: 'a' }, fakeRes(), () => allowed++);
  limiter({ key: 'b' }, fakeRes(), () => allowed++);
  assert.equal(allowed, 2);
});

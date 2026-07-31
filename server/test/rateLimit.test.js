const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter, createRedisRateLimiter } = require('../src/rateLimit');

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

// Fakes just the 3 redis-client methods the limiter uses, so these tests
// exercise the real INCR+PEXPIRE+PTTL logic without a real Redis server —
// same "inject a fake, keep production wiring real" style as pool.query
// monkey-patching elsewhere in this test suite.
function fakeRedisClient({ ttlMs = 5000 } = {}) {
  const counts = new Map();
  const expireCalls = [];
  return {
    counts,
    expireCalls,
    async incr(key) {
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return next;
    },
    async pExpire(key, ms) {
      expireCalls.push({ key, ms });
    },
    async pTTL() {
      return ttlMs;
    },
  };
}

test('redis-backed limiter allows up to max requests, then blocks with 429', async () => {
  const client = fakeRedisClient();
  const limiter = createRedisRateLimiter({
    windowMs: 1000,
    max: 2,
    keyGenerator: () => 'k',
    getRedisClient: async () => client,
  });

  let allowed = 0;
  for (let i = 0; i < 3; i++) {
    const res = fakeRes();
    await limiter({}, res, () => allowed++);
    if (i === 2) {
      assert.equal(res.statusCode, 429);
      assert.ok(res.headers['Retry-After']);
    }
  }
  assert.equal(allowed, 2);
});

test('redis-backed limiter only sets an expiry on the first increment in a window', async () => {
  const client = fakeRedisClient();
  const limiter = createRedisRateLimiter({
    windowMs: 1000,
    max: 5,
    keyGenerator: () => 'k',
    getRedisClient: async () => client,
  });

  await limiter({}, fakeRes(), () => {});
  await limiter({}, fakeRes(), () => {});
  await limiter({}, fakeRes(), () => {});

  assert.equal(client.expireCalls.length, 1);
  assert.equal(client.expireCalls[0].ms, 1000);
});

test('redis-backed limiter namespaces keys by name, so two limiters do not share a quota', async () => {
  const client = fakeRedisClient();
  const limiterA = createRedisRateLimiter({
    name: 'a',
    windowMs: 1000,
    max: 1,
    keyGenerator: () => 'same-key',
    getRedisClient: async () => client,
  });
  const limiterB = createRedisRateLimiter({
    name: 'b',
    windowMs: 1000,
    max: 1,
    keyGenerator: () => 'same-key',
    getRedisClient: async () => client,
  });

  let allowed = 0;
  await limiterA({}, fakeRes(), () => allowed++);
  await limiterB({}, fakeRes(), () => allowed++);
  assert.equal(allowed, 2); // would be 1 if they collided on the same Redis key
});

test('redis-backed limiter fails open if Redis is unreachable', async () => {
  const limiter = createRedisRateLimiter({
    windowMs: 1000,
    max: 1,
    keyGenerator: () => 'k',
    getRedisClient: async () => {
      throw new Error('connection refused');
    },
  });

  let allowed = 0;
  const res = fakeRes();
  await limiter({}, res, () => allowed++);
  assert.equal(allowed, 1);
  assert.equal(res.statusCode, null);
});

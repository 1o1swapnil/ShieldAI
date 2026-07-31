// Fixed-window limiter. In-memory (a plain Map) by default — single-process
// only, so a load balancer fanning out to multiple server replicas would
// give each replica its own independent quota, defeating the limit. Set
// REDIS_URL to share the counters across every replica instead.
function createRateLimiter(opts) {
  return process.env.REDIS_URL ? createRedisRateLimiter(opts) : createMemoryRateLimiter(opts);
}

// clock is injectable so tests don't need real sleeps.
function createMemoryRateLimiter({ windowMs, max, keyGenerator, message, clock = Date.now }) {
  const buckets = new Map();

  const sweep = setInterval(() => {
    const now = clock();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = clock();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: message || 'too many requests, try again later' });
    }
    next();
  };
}

// One shared connection per process, not one per limiter.
let clientPromise = null;
function getSharedClient() {
  if (!clientPromise) {
    const { createClient } = require('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('rate limiter redis connection error', err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

// INCR+PEXPIRE fixed window: the first request in a window creates the key
// and sets its TTL, every request after just increments it, so the window
// resets windowMs after the *first* request in it (not a true sliding
// window, same behavior as the in-memory version above). getRedisClient is
// injectable so tests can supply a fake client instead of a real server.
function createRedisRateLimiter({ windowMs, max, keyGenerator, message, name = 'ratelimit', getRedisClient = getSharedClient }) {
  return async (req, res, next) => {
    const key = `ratelimit:${name}:${keyGenerator(req)}`;
    try {
      const client = await getRedisClient();
      const count = await client.incr(key);
      if (count === 1) await client.pExpire(key, windowMs);

      if (count > max) {
        const ttl = await client.pTTL(key);
        res.setHeader('Retry-After', Math.ceil(Math.max(ttl, 0) / 1000));
        return res.status(429).json({ error: message || 'too many requests, try again later' });
      }
      next();
    } catch (err) {
      // Fails open: a Redis outage should degrade this defense-in-depth
      // brute-force/spam guard, not take down registration/login/invites
      // entirely for every user until Redis comes back.
      console.error('rate limiter redis error, allowing request through', err);
      next();
    }
  };
}

module.exports = { createRateLimiter, createRedisRateLimiter };

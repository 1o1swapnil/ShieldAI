// Small in-memory fixed-window limiter — no new dependency for something
// this simple. Single-process only; if this ever runs behind a load
// balancer with multiple instances, move the store to Redis.
//
// clock is injectable so tests don't need real sleeps.
function createRateLimiter({ windowMs, max, keyGenerator, message, clock = Date.now }) {
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

module.exports = { createRateLimiter };

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const healthRouter = require('../src/routes/health');

// Pulls the handler straight off the router instead of spinning up a real
// HTTP server + Postgres — CI has no DB service, so pool.query is stubbed to
// exercise both the healthy and unhealthy branches.
const handler = healthRouter.stack[0].route.stack[0].handle;

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };
}

test('GET /health returns 200 + ok when the DB round-trip succeeds', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ '?column?': 1 }] });
  try {
    const res = fakeRes();
    await handler({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  } finally {
    pool.query = originalQuery;
  }
});

test('GET /health returns 503 + error when the DB is unreachable', async () => {
  const originalQuery = pool.query;
  pool.query = async () => {
    throw new Error('connection refused');
  };
  try {
    const res = fakeRes();
    await handler({}, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { status: 'error' });
  } finally {
    pool.query = originalQuery;
  }
});

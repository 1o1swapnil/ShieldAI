const test = require('node:test');
const assert = require('node:assert/strict');

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    setHeader(k, v) {
      headers[k] = v;
    },
    sendStatus(code) {
      this.statusCode = code;
    },
  };
}

test('reflects an allowed origin and sets Vary', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com';
  delete require.cache[require.resolve('../src/cors')];
  const { cors } = require('../src/cors');

  const req = { headers: { origin: 'https://app.example.com' }, method: 'GET' };
  const res = fakeRes();
  let nextCalled = false;
  cors(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://app.example.com');
  assert.equal(res.headers['Vary'], 'Origin');
  assert.equal(nextCalled, true);
});

test('does not reflect an unrecognized origin', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com';
  delete require.cache[require.resolve('../src/cors')];
  const { cors } = require('../src/cors');

  const req = { headers: { origin: 'https://evil.example.com' }, method: 'GET' };
  const res = fakeRes();
  cors(req, res, () => {});

  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
});

test('short-circuits an OPTIONS preflight with 204', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com';
  delete require.cache[require.resolve('../src/cors')];
  const { cors } = require('../src/cors');

  const req = { headers: { origin: 'https://app.example.com' }, method: 'OPTIONS' };
  const res = fakeRes();
  let nextCalled = false;
  cors(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 204);
  assert.equal(nextCalled, false);
});

test('supports a comma-separated list of allowed origins', () => {
  process.env.WEB_ORIGIN = 'https://a.example.com, https://b.example.com';
  delete require.cache[require.resolve('../src/cors')];
  const { cors } = require('../src/cors');

  const res = fakeRes();
  cors({ headers: { origin: 'https://b.example.com' }, method: 'GET' }, res, () => {});
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://b.example.com');
});

test('always allows a chrome-extension:// origin regardless of WEB_ORIGIN', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com';
  delete require.cache[require.resolve('../src/cors')];
  const { cors } = require('../src/cors');

  const res = fakeRes();
  cors({ headers: { origin: 'chrome-extension://mlbmgnlkbonpafcipikdajccflfmgdbb' }, method: 'GET' }, res, () => {});
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'chrome-extension://mlbmgnlkbonpafcipikdajccflfmgdbb');
});

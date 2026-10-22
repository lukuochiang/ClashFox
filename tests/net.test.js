'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { createNet, isRetryableHttpError } = require('../src/main/services/net.js');

test('isRetryableHttpError: matches retryable codes and network error tags', () => {
  assert.strictEqual(isRetryableHttpError(new Error('TIMEOUT')), true);
  assert.strictEqual(isRetryableHttpError(new Error('ECONNRESET')), true);
  assert.strictEqual(isRetryableHttpError(new Error('ENOTFOUND')), true);
  for (const code of ['403', '408', '409', '425', '429', '500', '503']) {
    assert.strictEqual(isRetryableHttpError(new Error(`HTTP_${code}`)), true, `HTTP_${code}`);
  }
});

test('isRetryableHttpError: non-retryable and malformed', () => {
  assert.strictEqual(isRetryableHttpError(new Error('HTTP_404')), false);
  assert.strictEqual(isRetryableHttpError(new Error('HTTP_400')), false);
  assert.strictEqual(isRetryableHttpError(new Error('')), false);
  assert.strictEqual(isRetryableHttpError(new Error('INVALID_JSON')), false);
  assert.strictEqual(isRetryableHttpError(null), false);
});

test('createNet: defaults User-Agent when none injected', async () => {
  const net = createNet({});
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ua: req.headers['user-agent'] }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const out = await net.fetchTextFromRemoteUrl(`http://127.0.0.1:${port}/`);
    assert.strictEqual(JSON.parse(out.body).ua, 'ClashFox/0.0.0');
  } finally {
    server.close();
  }
});

test('fetchTextFromRemoteUrl: success, redirect chain, http error, invalid url', async () => {
  let injectedUa = '';
  const net = createNet({ getUserAgent: () => { injectedUa = 'ClashFox/test-ua'; return injectedUa; } });
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.statusCode = 302;
      res.setHeader('location', `http://127.0.0.1:${server.address().port}/final`);
      res.end();
      return;
    }
    if (req.url === '/boom') {
      res.statusCode = 500;
      res.end('nope');
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'text/yaml');
    res.end('proxies:\n  - name: x\n');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const ok = await net.fetchTextFromRemoteUrl(`${base}/final`);
    assert.ok(injectedUa === 'ClashFox/test-ua');
    assert.match(ok.body, /proxies/);
    assert.strictEqual(ok.contentType, 'text/yaml');

    const redirected = await net.fetchTextFromRemoteUrl(`${base}/redirect`);
    assert.match(redirected.body, /proxies/);
    assert.strictEqual(redirected.finalUrl, `${base}/final`);

    await assert.rejects(() => net.fetchTextFromRemoteUrl(`${base}/boom`), /HTTP_500/);
    await assert.rejects(() => net.fetchTextFromRemoteUrl(''), /INVALID_URL/);
    await assert.rejects(() => net.fetchTextFromRemoteUrl('not a url'), /INVALID_URL/);
  } finally {
    server.close();
  }
});

test('fetchJsonWithRetry (DI seam): retries on retryable error then succeeds', async () => {
  let calls = 0;
  const net = createNet({
    fetchJsonOverride: async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('HTTP_503');
      }
      return { ok: true, calls };
    },
  });
  const res = await net.fetchJsonWithRetry('https://example.invalid/api', { retries: 3, baseDelayMs: 1 });
  assert.deepStrictEqual(res, { ok: true, calls: 3 });
  assert.strictEqual(calls, 3);
});

test('fetchJsonWithRetry: does not retry non-retryable errors', async () => {
  let calls = 0;
  const net = createNet({
    fetchJsonOverride: async () => {
      calls += 1;
      throw new Error('HTTP_404');
    },
  });
  await assert.rejects(() => net.fetchJsonWithRetry('https://example.invalid/api', { retries: 3, baseDelayMs: 1 }), /HTTP_404/);
  assert.strictEqual(calls, 1);
});

test('fetchJsonWithRetry: exhausts retries and throws last error', async () => {
  let calls = 0;
  const net = createNet({
    fetchJsonOverride: async () => {
      calls += 1;
      throw new Error('TIMEOUT');
    },
  });
  await assert.rejects(() => net.fetchJsonWithRetry('https://example.invalid/api', { retries: 2, baseDelayMs: 1 }), /TIMEOUT/);
  assert.strictEqual(calls, 3); // attempts 0,1,2
});

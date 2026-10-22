'use strict';

// Network transport domain, extracted verbatim from src/main.js (Phase 2).
// electron's `app.getVersion()` is decoupled via an injected getUserAgent();
// an optional fetchJson override seam makes fetchJsonWithRetry unit-testable.

const http = require('http');
const https = require('https');
const { execFile } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpError(error) {
  const text = String((error && error.message) || error || '').trim().toUpperCase();
  if (!text) {
    return false;
  }
  if (
    text.includes('TIMEOUT')
    || text.includes('ECONNRESET')
    || text.includes('ETIMEDOUT')
    || text.includes('EAI_AGAIN')
    || text.includes('ENOTFOUND')
    || text.includes('ECONNREFUSED')
  ) {
    return true;
  }
  const match = text.match(/^HTTP_(\d{3})$/);
  if (!match) {
    return false;
  }
  const code = Number.parseInt(match[1], 10);
  if (!Number.isFinite(code)) {
    return false;
  }
  return code === 403 || code === 408 || code === 409 || code === 425 || code === 429 || code >= 500;
}

function createNet(deps = {}) {
  const { getUserAgent } = deps;
  const resolveUserAgent = typeof getUserAgent === 'function'
    ? getUserAgent
    : () => 'ClashFox/0.0.0';

  function fetchTextFromRemoteUrl(url, timeoutMs = 12000, depth = 0) {
    return new Promise((resolve, reject) => {
      if (depth > 5) {
        reject(new Error('TOO_MANY_REDIRECTS'));
        return;
      }
      const normalized = String(url || '').trim();
      if (!normalized) {
        reject(new Error('INVALID_URL'));
        return;
      }
      let parsed;
      try {
        parsed = new URL(normalized);
      } catch {
        reject(new Error('INVALID_URL'));
        return;
      }
      const client = parsed.protocol === 'http:' ? http : https;
      const req = client.get(parsed, {
        headers: {
          'User-Agent': resolveUserAgent(),
          Accept: 'application/x-yaml,application/yaml,text/yaml,text/plain,application/json,*/*',
        },
      }, (res) => {
        const statusCode = Number(res.statusCode || 0);
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(String(res.headers.location), parsed).toString();
          fetchTextFromRemoteUrl(nextUrl, timeoutMs, depth + 1).then(resolve).catch(reject);
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP_${statusCode}`));
          return;
        }
        const chunks = [];
        let totalBytes = 0;
        const maxBytes = 2 * 1024 * 1024;
        res.on('data', (chunk) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > maxBytes) {
            req.destroy(new Error('PAYLOAD_TOO_LARGE'));
            return;
          }
          chunks.push(buf);
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            body,
            contentType: String(res.headers['content-type'] || '').trim(),
            finalUrl: parsed.toString(),
          });
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('TIMEOUT'));
      });
    });
  }

  function fetchJson(url, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': resolveUserAgent(),
          Accept: 'application/vnd.github+json',
        },
      }, (res) => {
        const statusCode = Number(res.statusCode || 0);
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          res.resume();
          fetchJson(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP_${statusCode}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('INVALID_JSON'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('TIMEOUT'));
      });
    });
  }

  async function fetchJsonWithRetry(url, {
    timeoutMs = 8000,
    retries = 2,
    baseDelayMs = 280,
  } = {}) {
    const jsonFetcher = typeof deps.fetchJsonOverride === 'function' ? deps.fetchJsonOverride : fetchJson;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await jsonFetcher(url, timeoutMs);
      } catch (error) {
        lastError = error;
        const shouldRetry = attempt < retries && isRetryableHttpError(error);
        if (!shouldRetry) {
          throw error;
        }
        const jitter = Math.floor(Math.random() * 140);
        const delay = baseDelayMs * (2 ** attempt) + jitter;
        await sleep(delay);
      }
    }
    throw lastError || new Error('FETCH_JSON_WITH_RETRY_FAILED');
  }

  function fetchText(url, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': resolveUserAgent(),
          Accept: 'text/plain,*/*',
        },
      }, (res) => {
        const statusCode = Number(res.statusCode || 0);
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          res.resume();
          fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP_${statusCode}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve(String(body || ''));
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('TIMEOUT'));
      });
    });
  }

  function fetchTextViaCurl(url, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const maxTimeSec = Math.max(3, Math.ceil(Number(timeoutMs || 9000) / 1000));
      const args = [
        '--silent',
        '--show-error',
        '--location',
        '--max-time',
        String(maxTimeSec),
        '-H',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '-H',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        String(url || ''),
      ];
      execFile('/usr/bin/curl', args, { timeout: timeoutMs + 1000 }, (error, stdout = '', stderr = '') => {
        if (error) {
          reject(new Error(String(stderr || error.message || 'curl_fetch_failed').trim() || 'curl_fetch_failed'));
          return;
        }
        const text = String(stdout || '');
        if (!text.trim()) {
          reject(new Error('curl_empty_response'));
          return;
        }
        resolve(text);
      });
    });
  }

  function fetchLatestReleaseTagViaCurlHead(url, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const maxTimeSec = Math.max(3, Math.ceil(Number(timeoutMs || 7000) / 1000));
      const args = [
        '--silent',
        '--show-error',
        '--head',
        '--max-time',
        String(maxTimeSec),
        '-H',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        String(url || ''),
      ];
      execFile('/usr/bin/curl', args, { timeout: timeoutMs + 1000 }, (error, stdout = '', stderr = '') => {
        if (error) {
          reject(new Error(String(stderr || error.message || 'curl_head_failed').trim() || 'curl_head_failed'));
          return;
        }
        const text = String(stdout || '');
        const locationMatch = text.match(/^\s*location:\s*(.+)$/im);
        if (!locationMatch || !locationMatch[1]) {
          reject(new Error('head_location_missing'));
          return;
        }
        const location = String(locationMatch[1]).trim();
        const tagMatch = location.match(/\/releases\/tag\/([^/?#\s]+)/i);
        if (!tagMatch || !tagMatch[1]) {
          reject(new Error('head_tag_missing'));
          return;
        }
        resolve(tagMatch[1]);
      });
    });
  }

  return {
    fetchTextFromRemoteUrl,
    fetchJson,
    fetchJsonWithRetry,
    fetchText,
    fetchTextViaCurl,
    fetchLatestReleaseTagViaCurlHead,
  };
}

module.exports = {
  createNet,
  isRetryableHttpError,
};

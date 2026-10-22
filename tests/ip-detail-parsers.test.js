'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  extractIpFromPayload,
  parseNetworkDetailPayload,
  parseIpapiMetaPayload,
} = require('../src/main/services/ip-detail-parsers.js');

test('extractIpFromPayload: JSON candidate fields', () => {
  assert.strictEqual(extractIpFromPayload('{"ip":"1.2.3.4"}'), '1.2.3.4');
  assert.strictEqual(extractIpFromPayload('{"address":"5.6.7.8"}'), '5.6.7.8');
  assert.strictEqual(extractIpFromPayload('{"query":"9.9.9.9"}'), '9.9.9.9');
  assert.strictEqual(extractIpFromPayload('{"data":{"ip":"10.0.0.1"}}'), '10.0.0.1');
  assert.strictEqual(extractIpFromPayload('{"ipip":{"ip":"11.11.11.11"}}'), '11.11.11.11');
});

test('extractIpFromPayload: plain-text regex fallback', () => {
  assert.strictEqual(extractIpFromPayload('Current IP: 8.8.8.8 is great'), '8.8.8.8');
  assert.strictEqual(extractIpFromPayload(''), '');
  assert.strictEqual(extractIpFromPayload('no ip here'), '');
  // JSON present but no valid ip -> regex finds none
  assert.strictEqual(extractIpFromPayload('{"ip":"not-an-ip"}'), '');
});

test('parseNetworkDetailPayload: empty and non-json', () => {
  assert.deepStrictEqual(parseNetworkDetailPayload('', 'ep'), { ip: '', detail: '', source: 'ep' });
  const garbage = parseNetworkDetailPayload('not json 1.2.3.4', 'ep');
  assert.strictEqual(garbage.ip, '1.2.3.4');
  assert.strictEqual(garbage.detail, '');
  assert.strictEqual(garbage.source, 'ep');
});

test('parseNetworkDetailPayload: JSON location + isp summary', () => {
  const raw = JSON.stringify({ city: 'Tokyo', region: 'Kanto', country: 'Japan', isp: 'NTT' });
  const parsed = parseNetworkDetailPayload(`{"ip":"1.2.3.4","city":"Tokyo","region":"Kanto","country":"Japan","isp":"NTT"}`, 'ep');
  assert.strictEqual(parsed.ip, '1.2.3.4');
  assert.strictEqual(parsed.detail, 'Japan Kanto Tokyo · NTT');
  assert.ok(raw);
});

test('parseNetworkDetailPayload: nested location + string location fallback', () => {
  const nested = parseNetworkDetailPayload('{"ip":"2.2.2.2","location":{"city":"Berlin","country":"Germany"}}', 'ep');
  assert.strictEqual(nested.detail, 'Germany Berlin');
  const flatLoc = parseNetworkDetailPayload('{"ip":"3.3.3.3","location":"Paris, FR"}', 'ep');
  assert.strictEqual(flatLoc.detail, 'Paris, FR');
});

test('parseIpapiMetaPayload: empty and garbage', () => {
  assert.deepStrictEqual(parseIpapiMetaPayload(''), {
    originalIp: '',
    nativeIp: null,
    riskScore: null,
    riskLevel: '',
  });
  assert.deepStrictEqual(parseIpapiMetaPayload('not json'), {
    originalIp: '',
    nativeIp: null,
    riskScore: null,
    riskLevel: '',
  });
});

test('parseIpapiMetaPayload: clean ip -> low risk, native', () => {
  const meta = parseIpapiMetaPayload('{"ip":"1.2.3.4"}');
  assert.strictEqual(meta.originalIp, '1.2.3.4');
  assert.strictEqual(meta.riskScore, 0);
  assert.strictEqual(meta.riskLevel, 'low');
  assert.strictEqual(meta.nativeIp, true);
});

test('parseIpapiMetaPayload: vpn+proxy scoring and level', () => {
  const meta = parseIpapiMetaPayload('{"ip":"5.5.5.5","is_vpn":true,"is_proxy":true}');
  assert.strictEqual(meta.riskScore, 40); // 20 + 20
  assert.strictEqual(meta.riskLevel, 'medium');
  assert.strictEqual(meta.nativeIp, false);
});

test('parseIpapiMetaPayload: bogon alone -> high, clamps to 100', () => {
  const bogon = parseIpapiMetaPayload('{"ip":"9.9.9.9","is_bogon":true}');
  assert.strictEqual(bogon.riskScore, 40);
  assert.strictEqual(bogon.nativeIp, false);
  const everything = parseIpapiMetaPayload(
    '{"is_bogon":true,"is_datacenter":true,"is_tor":true,"is_proxy":true,"is_vpn":true,"is_abuser":true,"is_crawler":true,"is_mobile":true}',
  );
  assert.strictEqual(everything.riskScore, 100); // 166 clamped to 100
  assert.strictEqual(everything.riskLevel, 'high');
});

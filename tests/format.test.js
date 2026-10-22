'use strict';

const test = require('node:test');
const assert = require('node:assert');

const format = require('../src/ui/utils/format.js');

test('formatBytes: non-numeric and negative fall back to "-"', () => {
  assert.strictEqual(format.formatBytes(null), '-');
  assert.strictEqual(format.formatBytes(undefined), '-');
  assert.strictEqual(format.formatBytes('abc'), '-');
  assert.strictEqual(format.formatBytes(-10), '-');
  assert.strictEqual(format.formatBytes(Number.NaN), '-');
});

test('formatBytes: honors custom fallback', () => {
  assert.strictEqual(format.formatBytes(-5, { fallback: '0 B' }), '0 B');
  assert.strictEqual(format.formatBytes(null, { fallback: 'N/A' }), 'N/A');
});

test('formatBytes: zero uses zeroText when provided', () => {
  assert.strictEqual(format.formatBytes(0, { fallback: '0 B', zeroText: '0 B' }), '0 B');
  // without zeroText, 0 falls through the unit loop (legacy parity: "0.00 B")
  assert.strictEqual(format.formatBytes(0), '0.00 B');
});

test('formatBytes: scales units with the same precision rules as the legacy helper', () => {
  assert.strictEqual(format.formatBytes(1536), '1.50 KB');
  assert.strictEqual(format.formatBytes(10 * 1024), '10.0 KB');
  assert.strictEqual(format.formatBytes(100 * 1024 * 1024), '100 MB');
  assert.strictEqual(format.formatBytes(512), '512 B');
});

test('formatBytes: parses numeric strings like parseFloat', () => {
  assert.strictEqual(format.formatBytes('2048'), '2.00 KB');
});

test('formatRate: appends /s to the byte output', () => {
  assert.strictEqual(format.formatRate(1536), '1.50 KB/s');
  assert.strictEqual(format.formatRate(null), '-/s');
});

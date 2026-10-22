'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { resolvePanelPreset } = require('../src/main/services/panel-preset-resolver.js');

test('resolvePanelPreset: string key lookup (case-insensitive)', () => {
  const byString = resolvePanelPreset('ZaShBoArD');
  assert.ok(byString);
  assert.strictEqual(byString.name, 'zashboard');
  assert.strictEqual(typeof byString.url, 'string');
});

test('resolvePanelPreset: unknown string -> null', () => {
  assert.strictEqual(resolvePanelPreset('nope'), null);
  assert.strictEqual(resolvePanelPreset(''), null);
});

test('resolvePanelPreset: object with known name merges preset + override, lowercases name', () => {
  const merged = resolvePanelPreset({ name: 'MetaCubeXD', force: true });
  assert.strictEqual(merged.name, 'metacubexd');
  assert.strictEqual(merged.force, true);
  assert.strictEqual(typeof merged.url, 'string');
  assert.strictEqual(merged.displayName, 'MetaCubeXD');
});

test('resolvePanelPreset: object with unknown name passes through as-is', () => {
  const custom = { name: 'custom', url: 'https://example.com/x.zip' };
  assert.strictEqual(resolvePanelPreset(custom), custom);
});

test('resolvePanelPreset: non-object/non-string falsy -> null', () => {
  assert.strictEqual(resolvePanelPreset(null), null);
});

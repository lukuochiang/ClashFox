'use strict';

const test = require('node:test');
const assert = require('node:assert');

const theme = require('../src/ui/utils/fox-rank-theme.js');

test('getPalette: exposes the full 6-skin superset (regression guard for the old drift bug)', () => {
  assert.deepStrictEqual(theme.getPalette('campfire'), { start: '#ffb86c', end: '#ff8f57' });
  assert.deepStrictEqual(theme.getPalette('aurora'), { start: '#7df3d2', end: '#4bc6ff' });
  assert.deepStrictEqual(theme.getPalette('starlight'), { start: '#c685ff', end: '#8d6dff' });
  assert.deepStrictEqual(theme.getPalette('solar-crown'), { start: '#f6d365', end: '#fda085' });
  // These two were missing in foxboard.js / trackers.js before the dedup:
  assert.deepStrictEqual(theme.getPalette('nebula-flare'), { start: '#ff8bd8', end: '#8f7cff' });
  assert.deepStrictEqual(theme.getPalette('void-aurora'), { start: '#8ef0ff', end: '#6ea0ff' });
});

test('getPalette: normalizes case/whitespace and returns null for unknown skins', () => {
  assert.deepStrictEqual(theme.getPalette('  CAMPFIRE  '), { start: '#ffb86c', end: '#ff8f57' });
  assert.strictEqual(theme.getPalette('nope'), null);
  assert.strictEqual(theme.getPalette(''), null);
  assert.strictEqual(theme.getPalette(undefined), null);
});

test('normalizeSkinId: lowercases and trims', () => {
  assert.strictEqual(theme.normalizeSkinId(' Solar-Crown '), 'solar-crown');
  assert.strictEqual(theme.normalizeSkinId(null), '');
});

test('readSkinIdFromSettings: reads top-level or appearance.foxRankSkin with normalization', () => {
  assert.strictEqual(theme.readSkinIdFromSettings({ foxRankSkin: 'Aurora' }), 'aurora');
  assert.strictEqual(theme.readSkinIdFromSettings({ appearance: { foxRankSkin: 'StarLight' } }), 'starlight');
  assert.strictEqual(theme.readSkinIdFromSettings(null), '');
  assert.strictEqual(theme.readSkinIdFromSettings({}), '');
});

test('applyCssVars: is a no-op outside a DOM context (server/node safety)', () => {
  assert.doesNotThrow(() => theme.applyCssVars({ skinId: 'aurora', start: '#000', end: '#111' }));
});

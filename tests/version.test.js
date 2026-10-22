'use strict';

const test = require('node:test');
const assert = require('node:assert');

const version = require('../src/main/services/version.js');

test('normalizeVersionTag: strips leading v and whitespace', () => {
  assert.strictEqual(version.normalizeVersionTag('v1.2.3'), '1.2.3');
  assert.strictEqual(version.normalizeVersionTag('V1.2.3'), '1.2.3');
  assert.strictEqual(version.normalizeVersionTag('  1.2.3  '), '1.2.3');
  assert.strictEqual(version.normalizeVersionTag(''), '');
  assert.strictEqual(version.normalizeVersionTag(null), '');
});

test('parseVersion: parses full semver with optional prerelease', () => {
  const parsed = version.parseVersion('v1.22.3');
  assert.deepStrictEqual(
    { major: parsed.major, minor: parsed.minor, patch: parsed.patch, prerelease: parsed.prerelease, raw: parsed.raw },
    { major: 1, minor: 22, patch: 3, prerelease: [], raw: '1.22.3' },
  );
  const pre = version.parseVersion('1.19.0-alpha.7');
  assert.deepStrictEqual(pre.prerelease, ['alpha', 7]);
});

test('parseVersion: returns null for non-semver input', () => {
  assert.strictEqual(version.parseVersion('not-a-version'), null);
  assert.strictEqual(version.parseVersion('1.2'), null);
  assert.strictEqual(version.parseVersion(''), null);
});

test('compareVersions: numeric ordering on major/minor/patch', () => {
  assert.strictEqual(version.compareVersions('1.2.4', '1.2.3'), 1);
  assert.strictEqual(version.compareVersions('1.2.3', '1.2.4'), -1);
  assert.strictEqual(version.compareVersions('v2.0.0', '2.0.0'), 0);
  assert.strictEqual(version.compareVersions('2.0.0', '1.9.9'), 1);
});

test('compareVersions: release outranks prerelease', () => {
  assert.strictEqual(version.compareVersions('1.2.3', '1.2.3-alpha'), 1);
  assert.strictEqual(version.compareVersions('1.2.3-alpha', '1.2.3'), -1);
});

test('compareVersions: prerelease token comparison (numeric < alpha, per-token)', () => {
  assert.strictEqual(version.compareVersions('1.2.3-alpha.1', '1.2.3-alpha.2'), -1);
  assert.strictEqual(version.compareVersions('1.2.3-beta', '1.2.3-alpha'), 1);
  assert.strictEqual(version.compareVersions('1.2.3-alpha', '1.2.3-alpha'), 0);
});

test('compareVersions: falls back to localeCompare when unparseable', () => {
  // Both invalid -> normalized string compare, returns 0 for identical tags
  assert.strictEqual(version.compareVersions('foo', 'vfoo'), 0);
});

test('comparePrerelease: empty vs non-empty semantics', () => {
  assert.strictEqual(version.comparePrerelease([], []), 0);
  assert.strictEqual(version.comparePrerelease([], ['alpha']), 1);
  assert.strictEqual(version.comparePrerelease(['alpha'], []), -1);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  buildReleaseTagCandidates,
  extractInstallVersionHash,
  normalizeInstallVersionIdentity,
  currentKernelMatchesVersion,
} = require('../src/main/services/install-version.js');

test('buildReleaseTagCandidates: empty + v/no-v variants', () => {
  assert.deepStrictEqual(buildReleaseTagCandidates(''), []);
  assert.deepStrictEqual(buildReleaseTagCandidates('Prerelease-Alpha'), ['Prerelease-Alpha']);
  assert.deepStrictEqual(buildReleaseTagCandidates('v1.18.0'), ['v1.18.0', '1.18.0']);
  assert.deepStrictEqual(buildReleaseTagCandidates('1.18.0'), ['v1.18.0', '1.18.0']);
});

test('buildReleaseTagCandidates: prerelease suffix preserved', () => {
  const out = buildReleaseTagCandidates('v1.19.0-beta.1');
  assert.deepStrictEqual(out, ['v1.19.0-beta.1', '1.19.0-beta.1']);
});

test('extractInstallVersionHash: alpha branch vs first line', () => {
  assert.strictEqual(extractInstallVersionHash(''), '');
  assert.strictEqual(extractInstallVersionHash('  \n '), '');
  // non-alpha branch: first non-empty line
  assert.strictEqual(extractInstallVersionHash('\nabc123\nsecond', 'stable'), 'abc123');
  // Prerelease-Alpha branch: matches alpha-<hex>
  assert.strictEqual(extractInstallVersionHash('alpha-smart-deadbeef\nfoo', 'Prerelease-Alpha'), 'alpha-smart-deadbeef');
  assert.strictEqual(extractInstallVersionHash('alpha-cafe\nfoo', 'Prerelease-Alpha'), 'alpha-cafe');
});

test('normalizeInstallVersionIdentity: trim, drop leading v, lowercase', () => {
  assert.strictEqual(normalizeInstallVersionIdentity('  V1.18.0 '), '1.18.0');
  assert.strictEqual(normalizeInstallVersionIdentity(''), '');
});

test('currentKernelMatchesVersion: equality and substring containment', () => {
  assert.strictEqual(currentKernelMatchesVersion('', '1.0.0'), false);
  assert.strictEqual(currentKernelMatchesVersion('1.0.0', ''), false);
  assert.strictEqual(currentKernelMatchesVersion('V1.0.0', '1.0.0'), true);
  assert.strictEqual(currentKernelMatchesVersion('mihomo-1.0.0-build', '1.0.0'), true);
  assert.strictEqual(currentKernelMatchesVersion('1.0.0', 'mihomo-1.0.0-build'), true);
  assert.strictEqual(currentKernelMatchesVersion('1.0.0', '2.0.0'), false);
});

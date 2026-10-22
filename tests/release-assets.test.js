'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  extractSemverFromText,
  scoreHelperAsset,
  pickHelperAssetFromRelease,
  normalizeHelperVersion,
} = require('../src/main/services/release-assets.js');

test('extractSemverFromText: pulls clean semver', () => {
  assert.strictEqual(extractSemverFromText('Release v1.2.3 notes'), '1.2.3');
  assert.strictEqual(extractSemverFromText('1.19.0-alpha.7'), '1.19.0-alpha.7');
  assert.strictEqual(extractSemverFromText(''), '');
  assert.strictEqual(extractSemverFromText('no version here'), '');
});

test('extractSemverFromText: strips platform/arch suffix down to base', () => {
  // "1.2.3-darwin" -> suffix contains darwin -> return base
  assert.strictEqual(extractSemverFromText('v1.2.3-darwin'), '1.2.3');
  assert.strictEqual(extractSemverFromText('1.2.3-arm64.tar.gz'), '1.2.3');
  // non-platform suffix is preserved
  assert.strictEqual(extractSemverFromText('1.2.3-beta.2'), '1.2.3-beta.2');
});

test('scoreHelperAsset: rejects non-helper / wrong extension', () => {
  assert.strictEqual(scoreHelperAsset({ name: 'mihomo-darwin.tar.gz' }, 'arm64'), -1);
  assert.strictEqual(scoreHelperAsset({}, 'arm64'), -1);
  assert.strictEqual(scoreHelperAsset({ name: 'helper.exe' }, 'arm64'), -1);
});

test('scoreHelperAsset: rewards matching platform + arch', () => {
  const arm = scoreHelperAsset({ name: 'ClashFox-Helper-darwin-arm64.tar.gz' }, 'arm64');
  const x64onArm = scoreHelperAsset({ name: 'ClashFox-Helper-darwin-amd64.tar.gz' }, 'arm64');
  assert.ok(arm > x64onArm, `arm(${arm}) should beat x64(${x64onArm}) on arm64`);
  const universal = scoreHelperAsset({ name: 'ClashFox-Helper-darwin-universal.zip' }, 'arm64');
  assert.ok(arm > universal, 'arch-specific should beat universal');
});

test('pickHelperAssetFromRelease: returns best or null', () => {
  const release = {
    assets: [
      { name: 'helper-darwin-amd64.tar.gz' },
      { name: 'helper-darwin-arm64.tar.gz' },
      { name: 'README.md' },
    ],
  };
  const picked = pickHelperAssetFromRelease(release, 'arm64');
  assert.strictEqual(picked.name, 'helper-darwin-arm64.tar.gz');

  assert.strictEqual(pickHelperAssetFromRelease({ assets: [] }, 'arm64'), null);
  assert.strictEqual(pickHelperAssetFromRelease({}, 'arm64'), null);
  // only non-qualifying assets -> null (bestScore stays < 0)
  assert.strictEqual(pickHelperAssetFromRelease({ assets: [{ name: 'notes.txt' }] }, 'arm64'), null);
});

test('normalizeHelperVersion: json, regex, semver, empty', () => {
  assert.strictEqual(normalizeHelperVersion(''), '');
  assert.strictEqual(normalizeHelperVersion('  '), '');
  // well-formed JSON with version field
  assert.strictEqual(normalizeHelperVersion('{"version":"1.2.3"}'), '1.2.3');
  // regex path for near-json with a version key
  assert.strictEqual(normalizeHelperVersion('blah "version": "9.9.9" blah'), '9.9.9');
  // falls back to semver extraction from free text
  assert.strictEqual(normalizeHelperVersion('helper v3.4.5 released'), '3.4.5');
  // nothing recognizable -> empty
  assert.strictEqual(normalizeHelperVersion('no version at all'), '');
});

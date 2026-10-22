'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  pickLatestRelease,
  pickLatestKernelRelease,
  extractKernelSemver,
  isStableKernelVersion,
} = require('../src/main/services/kernel-release-selection.js');

test('pickLatestRelease: skips drafts and (by default) prereleases', () => {
  assert.strictEqual(pickLatestRelease(null), null);
  assert.strictEqual(pickLatestRelease([]), null);
  const releases = [
    { tag_name: 'v1', draft: true },
    { tag_name: 'v2', prerelease: true },
    { tag_name: 'v3' },
  ];
  assert.strictEqual(pickLatestRelease(releases, false).tag_name, 'v3');
  assert.strictEqual(pickLatestRelease(releases, true).tag_name, 'v2');
});

test('extractKernelSemver: normalizes leading v and tolerates suffix', () => {
  assert.strictEqual(extractKernelSemver('v1.18.0'), '1.18.0');
  assert.strictEqual(extractKernelSemver('release-1.18.2-rc1'), '1.18.2-rc1');
  assert.strictEqual(extractKernelSemver(''), '');
  assert.strictEqual(extractKernelSemver('no numbers'), '');
});

test('isStableKernelVersion: flags prerelease markers', () => {
  assert.strictEqual(isStableKernelVersion('1.18.0'), true);
  assert.strictEqual(isStableKernelVersion('v1.18.0'), true);
  assert.strictEqual(isStableKernelVersion('1.18.0-beta1'), false);
  assert.strictEqual(isStableKernelVersion('alpha-smart-2024'), false);
  assert.strictEqual(isStableKernelVersion('garbage'), false);
});

test('pickLatestKernelRelease: prefers a semver-bearing tag', () => {
  assert.strictEqual(pickLatestKernelRelease('notarray'), null);
  const releases = [
    { tag_name: 'notes-only' },
    { tag_name: 'v1.19.0' },
  ];
  assert.strictEqual(pickLatestKernelRelease(releases, false).tag_name, 'v1.19.0');
});

test('pickLatestKernelRelease: acceptBeta picks beta-like; else falls back', () => {
  const stable = [{ tag_name: 'v1.19.0' }];
  // not accepting beta: prerelease entries skipped entirely -> null
  assert.strictEqual(pickLatestKernelRelease([{ tag_name: 'v2.0.0-beta', prerelease: true }], false), null);
  // accepting beta: beta-like release chosen
  const picked = pickLatestKernelRelease([{ tag_name: 'v2.0.0-beta', prerelease: true }], true);
  assert.strictEqual(picked.tag_name, 'v2.0.0-beta');
  // accepting beta but only stable present -> still returns it as fallback (semver present)
  assert.strictEqual(pickLatestKernelRelease(stable, true).tag_name, 'v1.19.0');
});

test('pickLatestKernelRelease: returns fallback when no semver-bearing release', () => {
  const releases = [{ tag_name: 'weekly-build' }];
  // non-beta path: draft ok, prerelease false, acceptBeta false -> fallback set, no semver -> returns fallback
  assert.strictEqual(pickLatestKernelRelease(releases, false).tag_name, 'weekly-build');
});

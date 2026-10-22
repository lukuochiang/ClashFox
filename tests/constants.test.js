'use strict';

const test = require('node:test');
const assert = require('node:assert');

const presets = require('../src/ui/utils/panel-presets.js');
const constants = require('../src/main/constants.js');

test('panel presets expose zashboard and metacubexd with full fields', () => {
  for (const name of ['zashboard', 'metacubexd']) {
    const preset = presets.presets[name];
    assert.ok(preset, `preset ${name} should exist`);
    assert.strictEqual(preset.name, name);
    assert.ok(preset.displayName, `${name} needs displayName`);
    assert.ok(/^https:\/\//.test(preset.url), `${name} url must be https`);
    assert.strictEqual(preset['external-ui-url'], 'ui');
  }
});

test('constants re-export the same PANEL_PRESETS object as the shared module', () => {
  assert.strictEqual(constants.PANEL_PRESETS, presets.presets);
});

test('constants: update/kernel/helper URLs are well-formed https endpoints', () => {
  const urlStrings = [
    constants.CHECK_UPDATE_API_URL,
    constants.CHECK_UPDATE_STABLE_URL,
    constants.CHECK_UPDATE_BETA_URL,
    constants.HELPER_RELEASE_LATEST_URL,
    constants.KERNEL_RELEASE_API.vernesong,
    constants.KERNEL_RELEASE_API.MetaCubeX,
    constants.KERNEL_TAGS_API.vernesong,
    constants.KERNEL_TAGS_API.MetaCubeX,
    constants.KERNEL_BETA_VERSION_TXT_URL.vernesong,
    constants.KERNEL_BETA_VERSION_TXT_URL.MetaCubeX,
  ];
  for (const url of urlStrings) {
    assert.ok(/^https:\/\//.test(url), `expected https url, got: ${url}`);
  }
});

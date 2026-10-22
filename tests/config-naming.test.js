'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const naming = require('../src/main/services/config-naming.js');

test('isPathInsideDirectory: accepts path inside parent, rejects traversal/sibling', () => {
  const parent = path.join(os.tmpdir(), 'cfox-guard-parent');
  assert.strictEqual(naming.isPathInsideDirectory(path.join(parent, 'a.yaml'), parent), true);
  assert.strictEqual(naming.isPathInsideDirectory(parent, parent), true);
  assert.strictEqual(naming.isPathInsideDirectory(path.join(parent, '..', 'evil.yaml'), parent), false);
  // sibling dir sharing a prefix must NOT pass
  assert.strictEqual(naming.isPathInsideDirectory(`${parent}-other/a.yaml`, parent), false);
});

test('normalizeConfigRenameFileName: valid names, extension handling', () => {
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('my-sub', 'old.yaml'), { ok: true, fileName: 'my-sub.yaml' });
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('my-sub.yml', 'old.yaml'), { ok: true, fileName: 'my-sub.yml' });
  // keeps .yml fallback when current is .yml and no ext requested
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('renamed', 'old.yml'), { ok: true, fileName: 'renamed.yml' });
});

test('normalizeConfigRenameFileName: rejects unsafe or invalid inputs', () => {
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('', 'old.yaml'), { ok: false, error: 'invalid_name' });
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('a/b', 'old.yaml'), { ok: false, error: 'invalid_name' });
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('..', 'old.yaml'), { ok: false, error: 'invalid_name' });
  assert.deepStrictEqual(naming.normalizeConfigRenameFileName('name.txt', 'old.yaml'), { ok: false, error: 'invalid_extension' });
});

test('sanitizeImportedConfigFileName: strips query/hash and disallowed chars', () => {
  assert.strictEqual(naming.sanitizeImportedConfigFileName('sub?x=1#y'), 'sub');
  assert.strictEqual(naming.sanitizeImportedConfigFileName(''), 'imported-config');
  assert.strictEqual(naming.sanitizeImportedConfigFileName('my sub/2.yaml'), '2.yaml');
});

test('resolveImportedConfigExtension: prefers URL path ext, falls back to content-type', () => {
  assert.strictEqual(naming.resolveImportedConfigExtension('https://x.com/a.yml', ''), '.yml');
  assert.strictEqual(naming.resolveImportedConfigExtension('https://x.com/a.exe', 'application/json'), '.json');
  assert.strictEqual(naming.resolveImportedConfigExtension('https://x.com/a.exe', 'text/plain'), '.yaml');
});

test('buildImportedConfigFileName: ensures a config extension', () => {
  assert.strictEqual(naming.buildImportedConfigFileName('https://x.com/provider.yaml', ''), 'provider.yaml');
  assert.ok(naming.buildImportedConfigFileName('https://x.com/noext', 'text/yaml').endsWith('.yaml'));
});

test('decodePossibleBase64Payload + normalizeImportedConfigContent', () => {
  const yaml = 'proxies:\n  - name: a-long-enough-proxy-name\n';
  const b64 = Buffer.from(yaml, 'utf8').toString('base64');
  assert.strictEqual(naming.decodePossibleBase64Payload(b64), yaml.trim());
  // passthrough for plain config text
  assert.strictEqual(naming.normalizeImportedConfigContent(yaml), yaml.trim());
  // data URI
  assert.strictEqual(naming.decodePossibleBase64Payload(`data:application/octet-stream;base64,${b64}`), yaml.trim());
});

test('parseCommandOptionValues: collects values after flag', () => {
  assert.deepStrictEqual(naming.parseCommandOptionValues(['--index', '3', 'x', '--index', '5'], '--index'), ['3', '5']);
  assert.deepStrictEqual(naming.parseCommandOptionValues(['a', 'b'], '--missing'), []);
  assert.deepStrictEqual(naming.parseCommandOptionValues(['--index'], '--index'), []);
});

test('buildUniqueFilePath: appends counter when file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfox-naming-'));
  try {
    fs.writeFileSync(path.join(dir, 'dup.yaml'), 'x');
    const unique = naming.buildUniqueFilePath(dir, 'dup.yaml');
    assert.strictEqual(unique, path.join(dir, 'dup-1.yaml'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createFileListing } = require('../src/main/services/file-listing.js');

function withTempTree(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-filelisting-'));
  const dataDir = path.join(root, 'data');
  const coreDir = path.join(root, 'core');
  const backupDir = path.join(coreDir, 'cfox-backup');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'alpha.yaml'), 'proxy: {}');
  fs.writeFileSync(path.join(dataDir, 'beta.json'), '{}');
  fs.writeFileSync(path.join(dataDir, 'notes.txt'), 'ignored');
  fs.writeFileSync(path.join(coreDir, 'mihomo'), 'binary');
  fs.writeFileSync(path.join(coreDir, 'mihomo-darwin-arm64'), 'binary');
  fs.writeFileSync(
    path.join(backupDir, 'mihomo.backup.mihomo-darwin-arm64-v1.19.0.20241218_123456'),
    'backup',
  );
  try {
    return fn({ dataDir, coreDir });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('createFileListing validates its dependencies', () => {
  assert.throws(() => createFileListing({}), TypeError);
  assert.throws(
    () => createFileListing({ resolveDataDirectoryFromSettings: () => '/tmp' }),
    TypeError,
  );
});

test('listConfigFilesFromFs returns only yaml/json files sorted by modified time', () => {
  withTempTree(({ dataDir, coreDir }) => {
    const listing = createFileListing({
      resolveDataDirectoryFromSettings: () => dataDir,
      resolveCoreDirectoryFromSettings: () => coreDir,
    });
    const result = listing.listConfigFilesFromFs();
    assert.strictEqual(result.ok, true);
    const names = result.data.map((item) => item.name).sort();
    assert.deepStrictEqual(names, ['alpha.yaml', 'beta.json']);
    // internal field modifiedAt must be stripped from the output
    assert.strictEqual('modifiedAt' in result.data[0], false);
  });
});

test('listKernelFilesFromFs includes core binaries and backup files', () => {
  withTempTree(({ dataDir, coreDir }) => {
    const listing = createFileListing({
      resolveDataDirectoryFromSettings: () => dataDir,
      resolveCoreDirectoryFromSettings: () => coreDir,
    });
    const result = listing.listKernelFilesFromFs();
    assert.strictEqual(result.ok, true);
    const names = result.data.map((item) => item.name);
    assert.ok(names.includes('mihomo'));
    assert.ok(names.includes('mihomo-darwin-arm64'));
    assert.ok(names.some((n) => n.startsWith('mihomo.backup.')));
  });
});

test('listBackupFilesFromFs parses version/timestamp and assigns 1-based index', () => {
  withTempTree(({ dataDir, coreDir }) => {
    const listing = createFileListing({
      resolveDataDirectoryFromSettings: () => dataDir,
      resolveCoreDirectoryFromSettings: () => coreDir,
    });
    const result = listing.listBackupFilesFromFs();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data.length, 1);
    const backup = result.data[0];
    assert.strictEqual(backup.index, 1);
    assert.strictEqual(backup.version, 'mihomo-darwin-arm64-v1.19.0');
    assert.strictEqual(backup.timestamp, '20241218_123456');
  });
});

test('formatFileModifiedTime renders local YYYY-MM-DD HH:mm or "-" for invalid input', () => {
  const listing = createFileListing({
    resolveDataDirectoryFromSettings: () => '/tmp',
    resolveCoreDirectoryFromSettings: () => '/tmp',
  });
  assert.strictEqual(listing.formatFileModifiedTime('not-a-date'), '-');
  const out = listing.formatFileModifiedTime(new Date(2026, 0, 2, 3, 4));
  assert.match(out, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

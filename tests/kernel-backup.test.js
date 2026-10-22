'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createKernelBackup, formatBackupTimestamp } = require('../src/main/services/kernel-backup.js');

function makeBackup(name) {
  return `mihomo.backup.${name}`;
}

test('formatBackupTimestamp: zero-padded YYYYMMDD_HHMMSS', () => {
  const d = new Date(2024, 11, 18, 9, 5, 7); // Dec 18 2024 09:05:07 local
  assert.strictEqual(formatBackupTimestamp(d), '20241218_090507');
});

test('createKernelBackup: rejects missing injected deps', () => {
  assert.throws(() => createKernelBackup({ listBackupFilesFromFs: () => {} }), TypeError);
  assert.throws(() => createKernelBackup({ resolveCoreDirectoryFromSettings: () => {} }), TypeError);
});

test('deleteBackupFilesFromFs: deletes valid backups, guards paths & prefixes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfox-kb-'));
  try {
    const coreDir = path.join(root, 'core');
    const backupDir = path.join(coreDir, 'cfox-backup');
    fs.mkdirSync(backupDir, { recursive: true });
    const keep = path.join(backupDir, makeBackup('mihomo-darwin-arm64-v1.0'));
    const gone = path.join(backupDir, makeBackup('mihomo-darwin-x64-v1.1'));
    fs.writeFileSync(keep, 'a');
    fs.writeFileSync(gone, 'b');

    const api = createKernelBackup({
      resolveCoreDirectoryFromSettings: () => coreDir,
      listBackupFilesFromFs: () => ({ ok: true, data: [] }),
    });

    assert.deepStrictEqual(api.deleteBackupFilesFromFs([]), { ok: false, error: 'delete_empty' });
    // traversal outside backup dir
    assert.strictEqual(api.deleteBackupFilesFromFs([path.join(root, 'x')]).error, 'invalid_backup_path');
    // inside dir but wrong prefix
    const stray = path.join(backupDir, 'notabackup');
    fs.writeFileSync(stray, 'z');
    assert.strictEqual(api.deleteBackupFilesFromFs([stray]).error, 'invalid_backup_file');
    // valid
    const res = api.deleteBackupFilesFromFs([gone, keep]);
    assert.deepStrictEqual(res, { ok: true, deletedCount: 2 });
    assert.strictEqual(fs.existsSync(gone), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('switchKernelBackupFromFs: copies selected backup over active core', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfox-kb-sw-'));
  try {
    const coreDir = path.join(root, 'core');
    const backupDir = path.join(coreDir, 'cfox-backup');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, makeBackup('mihomo-darwin-arm64-v1.2'));
    fs.writeFileSync(backupFile, 'BINARY');

    const api = createKernelBackup({
      resolveCoreDirectoryFromSettings: () => coreDir,
      listBackupFilesFromFs: () => ({
        ok: true,
        data: [{ index: 1, name: path.basename(backupFile), path: backupFile }],
      }),
    });

    assert.strictEqual(api.switchKernelBackupFromFs(0).error, 'invalid_backup_index');
    assert.strictEqual(api.switchKernelBackupFromFs(9).error, 'backup_not_found');
    const res = api.switchKernelBackupFromFs(1);
    assert.strictEqual(res.ok, true);
    const active = path.join(coreDir, 'mihomo');
    assert.strictEqual(res.path, active);
    assert.strictEqual(fs.readFileSync(active, 'utf8'), 'BINARY');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('switchKernelBackupFromFs: propagates listing failure', () => {
  const api = createKernelBackup({
    resolveCoreDirectoryFromSettings: () => '/tmp/whatever',
    listBackupFilesFromFs: () => ({ ok: false, error: 'backups_read_failed' }),
  });
  assert.strictEqual(api.switchKernelBackupFromFs(1).error, 'backups_read_failed');
});

'use strict';

// Kernel backup delete/switch domain, extracted verbatim from src/main.js (Phase 2).
// Directory + listing resolvers are injected so this module stays free of
// settings/electron coupling and is unit-testable with a temp directory.

const fs = require('fs');
const path = require('path');
const { isPathInsideDirectory } = require('./config-naming.js');

function formatBackupTimestamp(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function createKernelBackup(deps = {}) {
  const {
    resolveCoreDirectoryFromSettings,
    listBackupFilesFromFs,
  } = deps;

  if (typeof resolveCoreDirectoryFromSettings !== 'function') {
    throw new TypeError('createKernelBackup requires resolveCoreDirectoryFromSettings');
  }
  if (typeof listBackupFilesFromFs !== 'function') {
    throw new TypeError('createKernelBackup requires listBackupFilesFromFs');
  }

  function deleteBackupFilesFromFs(paths = []) {
    try {
      const coreDir = resolveCoreDirectoryFromSettings();
      const backupDir = path.join(coreDir, 'cfox-backup');
      fs.mkdirSync(backupDir, { recursive: true });
      const targets = Array.isArray(paths)
        ? paths.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!targets.length) {
        return { ok: false, error: 'delete_empty' };
      }
      let deletedCount = 0;
      for (const target of targets) {
        if (!isPathInsideDirectory(target, backupDir)) {
          return { ok: false, error: 'invalid_backup_path', details: target };
        }
        const baseName = path.basename(target);
        if (!baseName.startsWith('mihomo.backup.')) {
          return { ok: false, error: 'invalid_backup_file', details: baseName };
        }
        if (!fs.existsSync(target)) {
          continue;
        }
        fs.unlinkSync(target);
        deletedCount += 1;
      }
      return { ok: true, deletedCount };
    } catch (error) {
      return {
        ok: false,
        error: 'delete_backups_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }

  function switchKernelBackupFromFs(index = 0) {
    try {
      const safeIndex = Number.parseInt(String(index || ''), 10);
      if (!Number.isFinite(safeIndex) || safeIndex <= 0) {
        return { ok: false, error: 'invalid_backup_index' };
      }
      const backupList = listBackupFilesFromFs();
      if (!backupList || backupList.ok === false) {
        return backupList || { ok: false, error: 'backups_read_failed' };
      }
      const selected = Array.isArray(backupList.data)
        ? backupList.data.find((item) => Number(item.index) === safeIndex)
        : null;
      if (!selected || !selected.path) {
        return { ok: false, error: 'backup_not_found' };
      }

      const coreDir = resolveCoreDirectoryFromSettings();
      const backupDir = path.join(coreDir, 'cfox-backup');
      const activeCore = path.join(coreDir, 'mihomo');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });

      if (!isPathInsideDirectory(selected.path, backupDir)) {
        return { ok: false, error: 'invalid_backup_path', details: selected.path };
      }

      fs.copyFileSync(selected.path, activeCore);
      fs.chmodSync(activeCore, 0o755);
      return {
        ok: true,
        selected: selected.name || path.basename(selected.path),
        path: activeCore,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'switch_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }

  return {
    deleteBackupFilesFromFs,
    switchKernelBackupFromFs,
  };
}

module.exports = {
  createKernelBackup,
  formatBackupTimestamp,
};

'use strict';

// Config / kernel / backup file-listing domain, extracted from src/main.js (Phase 2).
// The directory resolvers are injected so this module stays free of settings/electron
// coupling and is unit-testable with a temp directory.

const fs = require('fs');
const path = require('path');

function createFileListing(deps = {}) {
  const {
    resolveDataDirectoryFromSettings,
    resolveCoreDirectoryFromSettings,
  } = deps;

  if (typeof resolveDataDirectoryFromSettings !== 'function') {
    throw new TypeError('createFileListing requires resolveDataDirectoryFromSettings');
  }
  if (typeof resolveCoreDirectoryFromSettings !== 'function') {
    throw new TypeError('createFileListing requires resolveCoreDirectoryFromSettings');
  }

  function formatFileModifiedTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function listConfigFilesFromFs() {
    try {
      const configFilesDir = resolveDataDirectoryFromSettings();
      fs.mkdirSync(configFilesDir, { recursive: true });
      const items = fs.readdirSync(configFilesDir, { withFileTypes: true })
        .filter((entry) => entry && entry.isFile())
        .filter((entry) => /\.(ya?ml|json)$/i.test(String(entry.name || '')))
        .map((entry) => {
          const filePath = path.join(configFilesDir, entry.name);
          const stat = fs.statSync(filePath);
          return {
            name: entry.name,
            path: filePath,
            modified: formatFileModifiedTime(stat.mtime),
            modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
          };
        })
        .sort((a, b) => {
          const delta = Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0);
          if (delta !== 0) {
            return delta;
          }
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .map(({ modifiedAt, ...rest }) => rest);
      return { ok: true, data: items };
    } catch (error) {
      return {
        ok: false,
        error: 'configs_read_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }

  function listKernelFilesFromFs() {
    try {
      const coreDir = resolveCoreDirectoryFromSettings();
      fs.mkdirSync(coreDir, { recursive: true });
      const backupDir = path.join(coreDir, 'cfox-backup');
      fs.mkdirSync(backupDir, { recursive: true });

      // Read files from both core directory and backup directory
      const items = [];

      // Read from core directory
      const coreFiles = fs.readdirSync(coreDir, { withFileTypes: true })
        .filter((entry) => entry && (entry.isFile() || entry.isSymbolicLink()))
        .filter((entry) => {
          const name = String(entry.name || '');
          return name === 'mihomo' || name.startsWith('mihomo-darwin-');
        })
        .map((entry) => {
          const filePath = path.join(coreDir, entry.name);
          const stat = fs.statSync(filePath);
          return {
            name: entry.name,
            path: filePath,
            modified: formatFileModifiedTime(stat.mtime),
            modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
            size: String(stat.size || 0),
          };
        });

      items.push(...coreFiles);

      // Read from backup directory
      const backupFiles = fs.readdirSync(backupDir, { withFileTypes: true })
        .filter((entry) => entry && entry.isFile())
        .filter((entry) => {
          const name = String(entry.name || '');
          return name.startsWith('mihomo.backup.');
        })
        .map((entry) => {
          const filePath = path.join(backupDir, entry.name);
          const stat = fs.statSync(filePath);
          return {
            name: entry.name,
            path: filePath,
            modified: formatFileModifiedTime(stat.mtime),
            modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
            size: String(stat.size || 0),
          };
        });

      items.push(...backupFiles);

      // Sort by modified time descending
      items.sort((a, b) => {
        const delta = Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0);
        if (delta !== 0) {
          return delta;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      const result = items.map(({ modifiedAt, ...rest }) => rest);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: 'kernels_read_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }

  function listBackupFilesFromFs() {
    try {
      const coreDir = resolveCoreDirectoryFromSettings();
      const backupDir = path.join(coreDir, 'cfox-backup');
      fs.mkdirSync(backupDir, { recursive: true });

      const items = fs.readdirSync(backupDir, { withFileTypes: true })
        .filter((entry) => entry && entry.isFile())
        .filter((entry) => {
          const name = String(entry.name || '');
          return name.startsWith('mihomo.backup.');
        })
        .map((entry) => {
          const filePath = path.join(backupDir, entry.name);
          const stat = fs.statSync(filePath);

          // Extract version and timestamp from filename
          // Format: mihomo.backup.mihomo-darwin-amd64-v1.19.0.20241218_123456
          const name = entry.name;
          const backupRe = /^mihomo\.backup\.(mihomo-darwin-(amd64|arm64|x64)-.+)\.([0-9]{8}_[0-9]{6})$/;
          const match = name.match(backupRe);

          let version = '';
          let timestamp = '';
          if (match) {
            version = match[1];
            timestamp = match[3];
          }

          return {
            name: name,
            version: version,
            timestamp: timestamp,
            path: filePath,
            modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
          };
        })
        .sort((a, b) => {
          const delta = Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0);
          if (delta !== 0) {
            return delta;
          }
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

      // Add index to each item
      const result = items.map((item, index) => ({
        index: index + 1,
        ...item,
      }));
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: 'backups_read_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }

  return {
    formatFileModifiedTime,
    listConfigFilesFromFs,
    listKernelFilesFromFs,
    listBackupFilesFromFs,
  };
}

module.exports = { createFileListing };

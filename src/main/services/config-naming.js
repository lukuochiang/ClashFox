'use strict';

// Config import / rename / naming domain, extracted verbatim from src/main.js (Phase 2).
// Depends only on node builtins (fs/path) — no electron coupling, fully unit-testable.

const fs = require('fs');
const path = require('path');

function buildUniqueFilePath(targetDir, fileName) {
  const ext = path.extname(fileName || '');
  const base = path.basename(fileName || '', ext) || 'imported-config';
  let candidate = path.join(targetDir, `${base}${ext}`);
  let idx = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(targetDir, `${base}-${idx}${ext}`);
    idx += 1;
  }
  return candidate;
}

function sanitizeImportedConfigFileName(fileName = '') {
  const raw = String(fileName || '').trim().replace(/[?#].*$/, '');
  if (!raw) {
    return 'imported-config';
  }
  const baseName = path.basename(raw);
  const cleaned = baseName
    .replace(/[^0-9A-Za-z._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/-+/g, '-')
    .replace(/-+$/, '');
  return cleaned || 'imported-config';
}

function resolveImportedConfigExtension(urlText = '', contentType = '') {
  const allowSet = new Set(['.yaml', '.yml', '.json']);
  try {
    const parsed = new URL(String(urlText || ''));
    const extFromPath = String(path.extname(parsed.pathname || '') || '').toLowerCase();
    if (allowSet.has(extFromPath)) {
      return extFromPath;
    }
  } catch {}
  const typeText = String(contentType || '').toLowerCase();
  if (typeText.includes('json')) {
    return '.json';
  }
  return '.yaml';
}

function buildImportedConfigFileName(urlText = '', contentType = '') {
  let parsedBaseName = '';
  try {
    const parsed = new URL(String(urlText || ''));
    const decodedPath = decodeURIComponent(parsed.pathname || '');
    parsedBaseName = path.basename(decodedPath || '');
  } catch {
    parsedBaseName = '';
  }
  const sanitized = sanitizeImportedConfigFileName(parsedBaseName);
  const ext = resolveImportedConfigExtension(urlText, contentType);
  const currentExt = String(path.extname(sanitized || '') || '').toLowerCase();
  if (currentExt === '.yaml' || currentExt === '.yml' || currentExt === '.json') {
    return sanitized;
  }
  return `${sanitized}${ext}`;
}

function decodePossibleBase64Payload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  const normalizeDecoded = (decoded = '') => String(decoded || '').replace(/^\uFEFF/, '').trim();
  const looksLikeConfigText = (decoded = '') => {
    const candidate = normalizeDecoded(decoded);
    if (!candidate) {
      return false;
    }
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      return true;
    }
    if (candidate.includes('\n') && candidate.includes(':')) {
      return true;
    }
    return /(proxies|proxy-providers|rules|mixed-port|mode|allow-lan)\s*:/i.test(candidate);
  };
  const tryDecode = (base64Text = '') => {
    const normalizedBase64 = String(base64Text || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    if (!normalizedBase64) {
      return '';
    }
    const padded = normalizedBase64.padEnd(Math.ceil(normalizedBase64.length / 4) * 4, '=');
    try {
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      return normalizeDecoded(decoded);
    } catch {
      return '';
    }
  };

  const dataUriMatch = text.match(/^data:[^;,]+;base64,(.+)$/i);
  if (dataUriMatch && dataUriMatch[1]) {
    const decoded = tryDecode(dataUriMatch[1]);
    if (decoded) {
      return decoded;
    }
  }

  const compact = text.replace(/\s+/g, '');
  if (
    compact.length >= 32
    && /^[A-Za-z0-9+/=_-]+$/.test(compact)
  ) {
    const decoded = tryDecode(compact);
    if (decoded && looksLikeConfigText(decoded)) {
      return decoded;
    }
  }
  return '';
}

function normalizeImportedConfigContent(raw = '') {
  const source = String(raw || '').replace(/^\uFEFF/, '');
  const decoded = decodePossibleBase64Payload(source);
  const normalized = decoded || source;
  return String(normalized).replace(/\r\n/g, '\n').trim();
}

function normalizeConfigRenameFileName(inputName = '', currentName = '') {
  const raw = String(inputName || '').trim();
  if (!raw) {
    return { ok: false, error: 'invalid_name' };
  }
  if (raw.includes('/') || raw.includes('\\')) {
    return { ok: false, error: 'invalid_name' };
  }
  const safeRaw = raw.replace(/[\u0000-\u001f<>:"|?*]/g, '-').trim();
  if (!safeRaw || safeRaw === '.' || safeRaw === '..') {
    return { ok: false, error: 'invalid_name' };
  }
  const currentExt = String(path.extname(currentName || '') || '').toLowerCase();
  const requestedExt = String(path.extname(safeRaw || '') || '').toLowerCase();
  const fallbackExt = currentExt === '.yml' ? '.yml' : '.yaml';
  const ext = requestedExt || fallbackExt;
  if (!['.yaml', '.yml'].includes(ext)) {
    return { ok: false, error: 'invalid_extension' };
  }
  const baseName = String(path.basename(safeRaw, path.extname(safeRaw) || '') || '').trim();
  if (!baseName || baseName === '.' || baseName === '..') {
    return { ok: false, error: 'invalid_name' };
  }
  const finalName = `${baseName}${ext}`;
  return { ok: true, fileName: finalName };
}

function parseCommandOptionValues(args = [], flag = '') {
  const result = [];
  const targetFlag = String(flag || '').trim();
  if (!targetFlag) {
    return result;
  }
  for (let index = 0; index < args.length; index += 1) {
    const current = String(args[index] || '').trim();
    if (current !== targetFlag) {
      continue;
    }
    const next = String(args[index + 1] || '').trim();
    if (next) {
      result.push(next);
      index += 1;
    }
  }
  return result;
}

function isPathInsideDirectory(targetPath = '', parentDir = '') {
  const resolvedTarget = path.resolve(String(targetPath || '').trim());
  const resolvedParent = path.resolve(String(parentDir || '').trim());
  return resolvedTarget === resolvedParent || resolvedTarget.startsWith(`${resolvedParent}${path.sep}`);
}

module.exports = {
  buildUniqueFilePath,
  sanitizeImportedConfigFileName,
  resolveImportedConfigExtension,
  buildImportedConfigFileName,
  decodePossibleBase64Payload,
  normalizeImportedConfigContent,
  normalizeConfigRenameFileName,
  parseCommandOptionValues,
  isPathInsideDirectory,
};

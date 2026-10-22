'use strict';

// Install-version resolution & matching, extracted verbatim from src/main.js (Phase 2).
// Pure string/param transforms; no electron/fs/network.

function buildReleaseTagCandidates(versionBranch = '') {
  const normalized = String(versionBranch || '').trim();
  if (!normalized) {
    return [];
  }
  const candidates = [normalized];
  if (/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/i.test(normalized)) {
    candidates.push(normalized.replace(/^v/i, ''));
  } else if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/i.test(normalized)) {
    candidates.unshift(`v${normalized}`);
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function extractInstallVersionHash(versionInfo = '', versionBranch = '') {
  const raw = String(versionInfo || '');
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (String(versionBranch || '').trim() === 'Prerelease-Alpha') {
    const prereleaseMatch = trimmed.match(/alpha(?:-smart)?-[0-9a-f]+/i);
    if (prereleaseMatch && prereleaseMatch[0]) {
      return prereleaseMatch[0];
    }
  }
  const firstNonEmptyLine = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstNonEmptyLine || '';
}

function normalizeInstallVersionIdentity(value = '') {
  return String(value || '').trim().replace(/^v/i, '').toLowerCase();
}

function currentKernelMatchesVersion(currentVersion = '', targetVersion = '') {
  const current = normalizeInstallVersionIdentity(currentVersion);
  const target = normalizeInstallVersionIdentity(targetVersion);
  if (!current || !target) {
    return false;
  }
  return current === target || current.includes(target) || target.includes(current);
}

module.exports = {
  buildReleaseTagCandidates,
  extractInstallVersionHash,
  normalizeInstallVersionIdentity,
  currentKernelMatchesVersion,
};

'use strict';

// Semantic-version parsing/comparison domain, extracted verbatim from src/main.js (Phase 2).
// Fully pure: no electron / fs / network coupling, so it is unit-testable in isolation.

function normalizeVersionTag(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function parseVersion(version) {
  const normalized = normalizeVersionTag(version);
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prereleaseRaw] = match;
  const prerelease = prereleaseRaw
    ? prereleaseRaw.split('.').map((token) => {
      if (/^\d+$/.test(token)) {
        return Number.parseInt(token, 10);
      }
      return token.toLowerCase();
    })
    : [];
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    prerelease,
    raw: normalized,
  };
}

function comparePrerelease(left = [], right = []) {
  if (!left.length && !right.length) {
    return 0;
  }
  if (!left.length) {
    return 1;
  }
  if (!right.length) {
    return -1;
  }
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNum = typeof a === 'number';
    const bNum = typeof b === 'number';
    if (aNum && bNum) {
      return a > b ? 1 : -1;
    }
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b));
  }
  return 0;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    return String(normalizeVersionTag(left)).localeCompare(String(normalizeVersionTag(right)));
  }
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

module.exports = {
  normalizeVersionTag,
  parseVersion,
  comparePrerelease,
  compareVersions,
};

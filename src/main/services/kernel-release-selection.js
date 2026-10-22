'use strict';

// Kernel/helper release selection, extracted verbatim from src/main.js (Phase 2).
// Pure data transforms over release arrays; no electron/fs/network.

const { normalizeVersionTag, parseVersion } = require('./version.js');

function pickLatestRelease(releases = [], acceptBeta = false) {
  if (!Array.isArray(releases)) {
    return null;
  }
  for (const release of releases) {
    if (!release || release.draft) {
      continue;
    }
    if (!acceptBeta && release.prerelease) {
      continue;
    }
    return release;
  }
  return null;
}

function pickLatestKernelRelease(releases = [], acceptBeta = false) {
  if (!Array.isArray(releases)) {
    return null;
  }
  const betaLikePattern = /(alpha|beta|rc|pre(?:release)?|preview|nightly|canary|dev|smart)/i;
  const isBetaLikeRelease = (release) => {
    if (!release || release.draft) {
      return false;
    }
    if (release.prerelease) {
      return true;
    }
    const tagOrName = String(release.tag_name || release.name || '').trim();
    return betaLikePattern.test(tagOrName);
  };
  let fallback = null;
  for (const release of releases) {
    if (!release || release.draft) {
      continue;
    }
    if (!acceptBeta && release.prerelease) {
      continue;
    }
    if (acceptBeta && !isBetaLikeRelease(release)) {
      if (!fallback) {
        fallback = release;
      }
      continue;
    }
    if (!fallback) {
      fallback = release;
    }
    const latestTag = String(release.tag_name || release.name || '').trim();
    const latest = extractKernelSemver(latestTag);
    if (latest) {
      return release;
    }
  }
  return fallback;
}

function extractKernelSemver(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return '';
  }
  const match = source.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  return match ? normalizeVersionTag(match[0]) : '';
}

function isStableKernelVersion(raw = '') {
  const normalizedRaw = String(raw || '').toLowerCase();
  const prereleaseMarkerPattern = /(^|[^a-z0-9])(alpha-smart|alpha|beta|rc|pre(?:release)?|preview|nightly|canary|dev|smart)([^a-z0-9]|$)/i;
  if (prereleaseMarkerPattern.test(normalizedRaw)) {
    return false;
  }
  const semver = extractKernelSemver(raw);
  if (!semver) {
    return false;
  }
  const parsed = parseVersion(semver);
  return Boolean(parsed && (!Array.isArray(parsed.prerelease) || parsed.prerelease.length === 0));
}

module.exports = {
  pickLatestRelease,
  pickLatestKernelRelease,
  extractKernelSemver,
  isStableKernelVersion,
};

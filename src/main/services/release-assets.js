'use strict';

// Release-asset selection & semver extraction, extracted verbatim from src/main.js (Phase 2).
// Pure: depends only on normalizeVersionTag (version.js) and process.arch default.

const { normalizeVersionTag } = require('./version.js');

function extractSemverFromText(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return '';
  }
  const fullMatch = source.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?/);
  if (!fullMatch || !fullMatch[0]) {
    return '';
  }
  const candidate = normalizeVersionTag(fullMatch[0]);
  const baseMatch = candidate.match(/^\d+\.\d+\.\d+/);
  const base = baseMatch ? baseMatch[0] : '';
  if (!base) {
    return candidate;
  }
  const suffix = candidate.startsWith(`${base}-`) ? candidate.slice(base.length + 1) : '';
  if (!suffix) {
    return base;
  }
  if (/(darwin|linux|windows|macos|mac|arm64|aarch64|amd64|x64|x86|universal|tar|zip|gz|pkg|dmg)/i.test(suffix)) {
    return base;
  }
  return candidate;
}

function scoreHelperAsset(asset = {}, arch = process.arch) {
  const name = String(asset && asset.name ? asset.name : '').trim();
  if (!name) {
    return -1;
  }
  const lower = name.toLowerCase();
  if (!lower.includes('helper')) {
    return -1;
  }
  const extOk = lower.endsWith('.tar.gz')
    || lower.endsWith('.tgz')
    || lower.endsWith('.zip')
    || lower.endsWith('.gz')
    || lower === 'com.clashfox.helper'
    || lower.endsWith('/com.clashfox.helper');
  if (!extOk) {
    return -1;
  }
  let score = 0;
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac')) {
    score += 30;
  }
  if (arch === 'arm64') {
    if (lower.includes('arm64') || lower.includes('aarch64')) {
      score += 25;
    } else if (lower.includes('universal')) {
      score += 20;
    } else if (lower.includes('amd64') || lower.includes('x64')) {
      score -= 20;
    }
  } else if (arch === 'x64') {
    if (lower.includes('x64') || lower.includes('amd64')) {
      score += 25;
    } else if (lower.includes('universal')) {
      score += 20;
    } else if (lower.includes('arm64') || lower.includes('aarch64')) {
      score -= 20;
    }
  }
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    score += 8;
  } else if (lower.endsWith('.zip')) {
    score += 6;
  } else if (lower === 'com.clashfox.helper') {
    score += 4;
  }
  return score;
}

function pickHelperAssetFromRelease(release = {}, arch = process.arch) {
  const assets = Array.isArray(release && release.assets) ? release.assets : [];
  let best = null;
  let bestScore = -1;
  for (const asset of assets) {
    const score = scoreHelperAsset(asset, arch);
    if (score > bestScore) {
      bestScore = score;
      best = asset;
    }
  }
  if (!best || bestScore < 0) {
    return null;
  }
  return best;
}

function normalizeHelperVersion(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // ignore non-json format
  }
  const match = text.match(/"version"\s*:\s*"([^"]+)"/i);
  if (match && match[1]) {
    return String(match[1]).trim();
  }
  const semver = extractSemverFromText(text);
  if (semver) {
    return semver;
  }
  return '';
}

module.exports = {
  extractSemverFromText,
  scoreHelperAsset,
  pickHelperAssetFromRelease,
  normalizeHelperVersion,
};

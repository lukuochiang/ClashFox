(function initFoxRankTheme(globalScope) {
  // Single source of truth for FoxRank skin palettes.
  const PALETTES = {
    campfire: { start: '#ffb86c', end: '#ff8f57' },
    aurora: { start: '#7df3d2', end: '#4bc6ff' },
    starlight: { start: '#c685ff', end: '#8d6dff' },
    'solar-crown': { start: '#f6d365', end: '#fda085' },
    'nebula-flare': { start: '#ff8bd8', end: '#8f7cff' },
    'void-aurora': { start: '#8ef0ff', end: '#6ea0ff' },
  };
  const DEFAULT_COLORS = { start: '#8dc2fa', end: '#6ea7ea' };

  function normalizeSkinId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getPalette(skinId) {
    return PALETTES[normalizeSkinId(skinId)] || null;
  }

  function readSkinIdFromSettings(settings = null) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const appearance = source && typeof source.appearance === 'object' ? source.appearance : {};
    return normalizeSkinId(source.foxRankSkin || appearance.foxRankSkin || '');
  }

  function applyCssVars(palette = null, extraVars = null) {
    if (typeof document === 'undefined' || !document.documentElement) {
      return;
    }
    const resolved = {
      skinId: normalizeSkinId(palette && palette.skinId),
      start: String(palette && palette.start ? palette.start : DEFAULT_COLORS.start),
      end: String(palette && palette.end ? palette.end : DEFAULT_COLORS.end),
    };
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach((node) => {
      node.style.setProperty('--fox-rank-skin-start', resolved.start);
      node.style.setProperty('--fox-rank-skin-end', resolved.end);
      node.style.setProperty('--fox-rank-aura-start', resolved.start);
      node.style.setProperty('--fox-rank-aura-end', resolved.end);
      if (extraVars && typeof extraVars === 'object') {
        Object.entries(extraVars).forEach(([name, value]) => {
          node.style.setProperty(name, String(value || ''));
        });
      }
      if (resolved.skinId) {
        node.dataset.foxRankSkin = resolved.skinId;
      } else if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, 'foxRankSkin')) {
        delete node.dataset.foxRankSkin;
      }
    });
  }

  const api = {
    PALETTES,
    DEFAULT_COLORS,
    normalizeSkinId,
    getPalette,
    readSkinIdFromSettings,
    applyCssVars,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.CLASHFOX_FOX_RANK_THEME = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));

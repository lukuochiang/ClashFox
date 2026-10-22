'use strict';

// Panel preset resolution, extracted verbatim from src/main.js (Phase 2).
// Pure lookup/merge over the shared PANEL_PRESETS map; no electron/fs/network.

const PANEL_PRESETS = require('../constants.js').PANEL_PRESETS;

function resolvePanelPreset(preset = {}) {
  if (typeof preset === 'string') {
    return PANEL_PRESETS[String(preset || '').trim().toLowerCase()] || null;
  }
  const panelName = String((preset && preset.name) || '').trim().toLowerCase();
  if (panelName && PANEL_PRESETS[panelName]) {
    return {
      ...PANEL_PRESETS[panelName],
      ...(preset && typeof preset === 'object' ? preset : {}),
      name: panelName,
    };
  }
  if (preset && typeof preset === 'object') {
    return preset;
  }
  return null;
}

module.exports = {
  resolvePanelPreset,
};

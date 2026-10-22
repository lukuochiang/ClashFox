(function initPanelPresets(globalScope) {
  const presets = {
    zashboard: {
      name: 'zashboard',
      displayName: 'Zashboard',
      url: 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
      'external-ui-url': 'ui',
    },
    metacubexd: {
      name: 'metacubexd',
      displayName: 'MetaCubeXD',
      url: 'https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz',
      'external-ui-url': 'ui',
    },
  };

  const api = { presets };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.CLASHFOX_PANEL_PRESETS = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));

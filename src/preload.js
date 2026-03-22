const { contextBridge, ipcRenderer } = require('electron');

let appInfoCache = null;
let appInfoPromise = null;

function fetchAppInfo(force = false) {
  if (!force && appInfoCache) {
    return Promise.resolve(appInfoCache);
  }
  if (!force && appInfoPromise) {
    return appInfoPromise;
  }
  appInfoPromise = ipcRenderer.invoke('clashfox:appInfo')
    .then((response) => {
      if (response && response.ok && response.data) {
        appInfoCache = response;
      }
      return response;
    })
    .finally(() => {
      appInfoPromise = null;
    });
  return appInfoPromise;
}

function invalidateAppInfoCache() {
  appInfoCache = null;
  appInfoPromise = null;
}

contextBridge.exposeInMainWorld('clashfox', {
  runCommand: (command, args = [], options = {}) => ipcRenderer.invoke('clashfox:command', command, args, options),
  detectTunConflict: () => ipcRenderer.invoke('clashfox:detectTunConflict'),
  worldwideSnapshot: (options = {}) => ipcRenderer.invoke('clashfox:worldwideSnapshot', options),
  dashboardSnapshot: (options = {}) => ipcRenderer.invoke('clashfox:dashboardSnapshot', options),
  providerSubscriptionOverview: () => ipcRenderer.invoke('clashfox:providerSubscriptionOverview'),
  providerProxyTree: () => ipcRenderer.invoke('clashfox:providerProxyTree'),
  rulesOverview: () => ipcRenderer.invoke('clashfox:rulesOverview'),
  ruleProvidersOverview: () => ipcRenderer.invoke('clashfox:ruleProvidersOverview'),
  cancelCommand: () => ipcRenderer.invoke('clashfox:cancelCommand'),
  selectConfig: () => ipcRenderer.invoke('clashfox:selectConfig'),
  importConfig: () => ipcRenderer.invoke('clashfox:importConfig'),
  deleteConfig: (targetPath) => ipcRenderer.invoke('clashfox:deleteConfig', targetPath),
  selectDirectory: (title) => ipcRenderer.invoke('clashfox:selectDirectory', title),
  getAppInfo: (force = false) => fetchAppInfo(force),
  refreshAppInfo: () => {
    invalidateAppInfoCache();
    return fetchAppInfo(true);
  },
  checkUpdates: (options = {}) => ipcRenderer.invoke('clashfox:checkUpdates', options),
  checkKernelUpdates: (options = {}) => ipcRenderer.invoke('clashfox:checkKernelUpdates', options),
  installMihomo: (options = {}) => ipcRenderer.invoke('clashfox:install-mihomo', options),
  onInstallMihomoProgress: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:install-mihomo:progress', listener);
    return () => ipcRenderer.removeListener('clashfox:install-mihomo:progress', listener);
  },
  checkHelperUpdates: (options = {}) => ipcRenderer.invoke('clashfox:checkHelperUpdates', options),
  installHelper: () => ipcRenderer.invoke('clashfox:installHelper'),
  uninstallHelper: () => ipcRenderer.invoke('clashfox:uninstallHelper'),
  runHelperInstallInTerminal: () => ipcRenderer.invoke('clashfox:runHelperInstallInTerminal'),
  getHelperInstallPath: () => ipcRenderer.invoke('clashfox:getHelperInstallPath'),
  pingHelper: () => ipcRenderer.invoke('clashfox:pingHelper'),
  getHelperStatus: () => ipcRenderer.invoke('clashfox:getHelperStatus'),
  doctorHelper: (options = {}) => ipcRenderer.invoke('clashfox:doctorHelper', options),
  openHelperLogs: () => ipcRenderer.invoke('clashfox:openHelperLogs'),
  openPath: (targetPath) => ipcRenderer.invoke('clashfox:openPath', targetPath),
  getOverviewNetworkSnapshot: () => ipcRenderer.invoke('clashfox:getOverviewNetworkSnapshot'),
  installPanel: (preset) => ipcRenderer.invoke('clashfox:installPanel', preset),
  activatePanel: (panelName) => ipcRenderer.invoke('clashfox:activatePanel', panelName),
  getMihomoVersion: (source = {}) => ipcRenderer.invoke('clashfox:getMihomoVersion', source),
  getMihomoConfigs: (source = {}) => ipcRenderer.invoke('clashfox:getMihomoConfigs', source),
  updateMihomoConfig: (patch = {}, source = {}) => ipcRenderer.invoke('clashfox:updateMihomoConfig', patch, source),
  updateMihomoAllowLan: (enabled, source = {}) => ipcRenderer.invoke('clashfox:updateMihomoAllowLan', Boolean(enabled), source),
  reloadMihomoCore: (source = {}) => ipcRenderer.invoke('clashfox:reloadMihomoCore', source),
  reloadMihomoConfig: (source = {}) => ipcRenderer.invoke('clashfox:reloadMihomoConfig', source),
  // openAbout: () => ipcRenderer.invoke('clashfox:openAbout'),
  openExternal: (url) => ipcRenderer.invoke('clashfox:openExternal', url),
  setDebugMode: (enabled) => ipcRenderer.invoke('clashfox:setDebugMode', Boolean(enabled)),
  setThemeSource: (source) => ipcRenderer.invoke('clashfox:setThemeSource', source),
  readSettings: () => ipcRenderer.invoke('clashfox:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('clashfox:writeSettings', data),
  getSystemLocale: () => ipcRenderer.invoke('clashfox:getSystemLocale'),
  getUserDataPath: () => ipcRenderer.invoke('clashfox:userDataPath'),
  cleanLogs: (mode = 'all') => ipcRenderer.invoke('clashfox:cleanLogs', mode),
  revealInFinder: (targetPath) => ipcRenderer.invoke('clashfox:revealInFinder', targetPath),
  clearUiStorage: () => ipcRenderer.invoke('clashfox:clearUiStorage'),
  onSystemThemeChange: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:systemTheme', listener);
    return () => ipcRenderer.removeListener('clashfox:systemTheme', listener);
  },
  onTrayRefresh: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = () => handler();
    ipcRenderer.on('clashfox:trayRefresh', listener);
    return () => ipcRenderer.removeListener('clashfox:trayRefresh', listener);
  },
  onMainToast: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:mainToast', listener);
    return () => ipcRenderer.removeListener('clashfox:mainToast', listener);
  },
  onMainCoreAction: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:mainCoreAction', listener);
    return () => ipcRenderer.removeListener('clashfox:mainCoreAction', listener);
  },
  onMainNavigate: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:mainNavigate', listener);
    return () => ipcRenderer.removeListener('clashfox:mainNavigate', listener);
  },
  onMainWindowResize: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:mainWindowResize', listener);
    return () => ipcRenderer.removeListener('clashfox:mainWindowResize', listener);
  },
  onSettingsUpdated: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:settingsUpdated', listener);
    return () => ipcRenderer.removeListener('clashfox:settingsUpdated', listener);
  },
  trayMenuGetData: () => ipcRenderer.invoke('clashfox:trayMenu:getData'),
  trayMenuGetConnectivity: (force = false) => ipcRenderer.invoke('clashfox:trayMenu:connectivity', Boolean(force)),
  trayMenuAction: (action, payload = {}) => ipcRenderer.invoke('clashfox:trayMenu:action', action, payload),
  trayMenuHide: () => ipcRenderer.send('clashfox:trayMenu:hide'),
  trayMenuSetExpanded: (expanded, payload = {}) => ipcRenderer.send('clashfox:trayMenu:setExpanded', Boolean(expanded), payload),
  trayMenuOpenSubmenu: (payload = {}) => ipcRenderer.send('clashfox:trayMenu:openSubmenu', payload),
  trayMenuCloseSubmenu: () => ipcRenderer.send('clashfox:trayMenu:closeSubmenu'),
  trayMenuOpenPanel: (payload = {}) => ipcRenderer.send('clashfox:trayMenu:openPanel', payload),
  trayMenuClosePanel: () => ipcRenderer.send('clashfox:trayMenu:closePanel'),
  trayMenuRendererReady: () => ipcRenderer.send('clashfox:trayMenu:rendererReady'),
  onTrayMenuUpdate: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:trayMenu:update', listener);
    return () => ipcRenderer.removeListener('clashfox:trayMenu:update', listener);
  },
  onTrayMenuVisibility: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:trayMenu:visibility', listener);
    return () => ipcRenderer.removeListener('clashfox:trayMenu:visibility', listener);
  },
  traySubmenuResize: (payload = {}) => ipcRenderer.send('clashfox:traySubmenu:resize', payload),
  traySubmenuHover: (hovering) => ipcRenderer.send('clashfox:traySubmenu:hover', Boolean(hovering)),
  traySubmenuReady: () => ipcRenderer.send('clashfox:traySubmenu:ready'),
  traySubmenuHide: () => ipcRenderer.send('clashfox:traySubmenu:hide'),
  onTraySubmenuUpdate: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:traySubmenu:update', listener);
    return () => ipcRenderer.removeListener('clashfox:traySubmenu:update', listener);
  },
  onTraySubmenuVisibility: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:traySubmenu:visibility', listener);
    return () => ipcRenderer.removeListener('clashfox:traySubmenu:visibility', listener);
  },
  trayPanelResize: (payload = {}) => ipcRenderer.send('clashfox:trayPanel:resize', payload),
  trayPanelHover: (hovering) => ipcRenderer.send('clashfox:trayPanel:hover', Boolean(hovering)),
  trayPanelReady: () => ipcRenderer.send('clashfox:trayPanel:ready'),
  trayPanelHide: () => ipcRenderer.send('clashfox:trayPanel:hide'),
  onTrayPanelUpdate: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:trayPanel:update', listener);
    return () => ipcRenderer.removeListener('clashfox:trayPanel:update', listener);
  },
  onTrayPanelVisibility: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:trayPanel:visibility', listener);
    return () => ipcRenderer.removeListener('clashfox:trayPanel:visibility', listener);
  },
});

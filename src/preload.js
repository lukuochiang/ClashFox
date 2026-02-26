const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clashfox', {
  runCommand: (command, args = [], options = {}) => ipcRenderer.invoke('clashfox:command', command, args, options),
  cancelCommand: () => ipcRenderer.invoke('clashfox:cancelCommand'),
  selectConfig: () => ipcRenderer.invoke('clashfox:selectConfig'),
  selectDirectory: (title) => ipcRenderer.invoke('clashfox:selectDirectory', title),
  getAppInfo: () => ipcRenderer.invoke('clashfox:appInfo'),
  installHelper: () => ipcRenderer.invoke('clashfox:installHelper'),
  uninstallHelper: () => ipcRenderer.invoke('clashfox:uninstallHelper'),
  runHelperInstallInTerminal: () => ipcRenderer.invoke('clashfox:runHelperInstallInTerminal'),
  getHelperInstallPath: () => ipcRenderer.invoke('clashfox:getHelperInstallPath'),
  pingHelper: () => ipcRenderer.invoke('clashfox:pingHelper'),
  getHelperStatus: () => ipcRenderer.invoke('clashfox:getHelperStatus'),
  openHelperLogs: () => ipcRenderer.invoke('clashfox:openHelperLogs'),
  openPath: (targetPath) => ipcRenderer.invoke('clashfox:openPath', targetPath),
  // openAbout: () => ipcRenderer.invoke('clashfox:openAbout'),
  openExternal: (url) => ipcRenderer.invoke('clashfox:openExternal', url),
  setDebugMode: (enabled) => ipcRenderer.invoke('clashfox:setDebugMode', Boolean(enabled)),
  setThemeSource: (source) => ipcRenderer.invoke('clashfox:setThemeSource', source),
  readSettings: () => ipcRenderer.invoke('clashfox:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('clashfox:writeSettings', data),
  getUserDataPath: () => ipcRenderer.invoke('clashfox:userDataPath'),
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
  trayMenuGetData: () => ipcRenderer.invoke('clashfox:trayMenu:getData'),
  trayMenuGetConnectivity: () => ipcRenderer.invoke('clashfox:trayMenu:connectivity'),
  trayMenuAction: (action, payload = {}) => ipcRenderer.invoke('clashfox:trayMenu:action', action, payload),
  trayMenuHide: () => ipcRenderer.send('clashfox:trayMenu:hide'),
  trayMenuSetExpanded: (expanded, payload = {}) => ipcRenderer.send('clashfox:trayMenu:setExpanded', Boolean(expanded), payload),
  trayMenuOpenSubmenu: (payload = {}) => ipcRenderer.send('clashfox:trayMenu:openSubmenu', payload),
  trayMenuCloseSubmenu: () => ipcRenderer.send('clashfox:trayMenu:closeSubmenu'),
  trayMenuRendererReady: () => ipcRenderer.send('clashfox:trayMenu:rendererReady'),
  onTrayMenuUpdate: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:trayMenu:update', listener);
    return () => ipcRenderer.removeListener('clashfox:trayMenu:update', listener);
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
});

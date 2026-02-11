const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clashfox', {
  runCommand: (command, args = []) => ipcRenderer.invoke('clashfox:command', command, args),
  cancelCommand: () => ipcRenderer.invoke('clashfox:cancelCommand'),
  selectConfig: () => ipcRenderer.invoke('clashfox:selectConfig'),
  selectDirectory: (title) => ipcRenderer.invoke('clashfox:selectDirectory', title),
  getAppInfo: () => ipcRenderer.invoke('clashfox:appInfo'),
  // openAbout: () => ipcRenderer.invoke('clashfox:openAbout'),
  openExternal: (url) => ipcRenderer.invoke('clashfox:openExternal', url),
  setDebugMode: (enabled) => ipcRenderer.invoke('clashfox:setDebugMode', Boolean(enabled)),
  setThemeSource: (source) => ipcRenderer.invoke('clashfox:setThemeSource', source),
  readSettings: () => ipcRenderer.invoke('clashfox:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('clashfox:writeSettings', data),
  getUserDataPath: () => ipcRenderer.invoke('clashfox:userDataPath'),
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
});

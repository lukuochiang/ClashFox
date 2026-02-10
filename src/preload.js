const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clashfox', {
  runCommand: (command, args = []) => ipcRenderer.invoke('clashfox:command', command, args),
  cancelCommand: () => ipcRenderer.invoke('clashfox:cancelCommand'),
  selectConfig: () => ipcRenderer.invoke('clashfox:selectConfig'),
  selectDirectory: (title) => ipcRenderer.invoke('clashfox:selectDirectory', title),
  getAppInfo: () => ipcRenderer.invoke('clashfox:appInfo'),
  openAbout: () => ipcRenderer.invoke('clashfox:openAbout'),
  setDebugMode: (enabled) => ipcRenderer.invoke('clashfox:setDebugMode', Boolean(enabled)),
  readSettings: () => ipcRenderer.invoke('clashfox:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('clashfox:writeSettings', data),
  onSystemThemeChange: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('clashfox:systemTheme', listener);
    return () => ipcRenderer.removeListener('clashfox:systemTheme', listener);
  },
});

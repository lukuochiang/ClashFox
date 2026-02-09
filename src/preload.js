const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clashfox', {
  runCommand: (command, args = []) => ipcRenderer.invoke('clashfox:command', command, args),
  cancelCommand: () => ipcRenderer.invoke('clashfox:cancelCommand'),
  selectConfig: () => ipcRenderer.invoke('clashfox:selectConfig'),
  getAppInfo: () => ipcRenderer.invoke('clashfox:appInfo'),
  openAbout: () => ipcRenderer.invoke('clashfox:openAbout'),
});
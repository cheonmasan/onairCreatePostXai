const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
    startUpload: () => ipcRenderer.invoke('start-upload'),
    stopUpload: () => ipcRenderer.invoke('stop-upload')
});
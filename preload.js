const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeWindow: () => ipcRenderer.send('close-window'),
    launchMinecraft: (ram) => ipcRenderer.send('launch-minecraft', ram),
    getUsername: () => ipcRenderer.invoke('get-username'),
    selectMod: () => ipcRenderer.invoke('select-mod'),
    microsoftLogin: () => ipcRenderer.invoke('microsoft-login'),
    offlineLogin: (name) => ipcRenderer.send('offline-login', name),
    getMods: () => ipcRenderer.invoke('get-mods'),
    deleteMod: (name) => ipcRenderer.invoke('delete-mod', name),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onLaunchProgress: (callback) => ipcRenderer.on('launch-progress', (event, message) => callback(message)),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', () => callback()),
    onUpdateReady: (callback) => ipcRenderer.on('update-ready', () => callback()),
    restartAndUpdate: () => ipcRenderer.invoke('restart-and-update'),
});

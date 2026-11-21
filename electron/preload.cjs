const { contextBridge, ipcRenderer } = require('electron')

// The mail backend runs in the main process (backend.cjs); the page reaches it
// through this one call. Nothing goes to a server of ours.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  mailApi: (req) => ipcRenderer.invoke('mail-api', req),
})

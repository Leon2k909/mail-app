const { app, BrowserWindow, nativeImage, globalShortcut, session, ipcMain, safeStorage } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const { createBackend } = require('./backend.cjs')

const isDev = process.env.NODE_ENV === 'development'

// Mail backend runs here, on this PC. Passwords are encrypted with the
// operating system's own key store (DPAPI on Windows) before they hit disk.
function setupMailBackend() {
  const backend = createBackend({
    dataDir: path.join(app.getPath('userData'), 'mail-data'),
    encrypt: async (text) => {
      if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('This PC can\'t encrypt saved passwords')
      return (await safeStorage.encryptStringAsync(text)).toString('base64')
    },
    decrypt: async (enc) => (enc ? (await safeStorage.decryptStringAsync(Buffer.from(enc, 'base64'))).result : ''),
  })
  ipcMain.handle('mail-api', (event, req) => {
    // Only the app's own page may call it (not the disposable-mail webview).
    const url = event.senderFrame?.url || ''
    const ours = url.startsWith('file://') || (isDev && url.startsWith('http://localhost:5173'))
    if (!ours) return { status: 403, data: { error: 'Forbidden' } }
    return backend.handle(req)
  })
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.logger = null

// Ad/tracker domains to block in the disposablemail webview partition
const AD_DOMAINS = [
  'googlesyndication.com', 'doubleclick.net', 'googletagmanager.com',
  'googletagservices.com', 'google-analytics.com', 'analytics.google.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'amazon-adsystem.com', 'ads.yahoo.com', 'advertising.com',
  'outbrain.com', 'taboola.com', 'revcontent.com', 'mgid.com',
  'popads.net', 'popcash.net', 'propellerads.com', 'adcash.com',
  'exoclick.com', 'trafficjunky.com', 'juicyads.com', 'hilltopads.net',
  'adsterra.com', 'clickadu.com', 'bidvertiser.com', 'yllix.com',
  'a-ads.com', 'coinzilla.io', 'media.net', 'criteo.com',
  'facebook.com/tr', 'connect.facebook.net', 'hotjar.com',
  'clarity.ms', 'mouseflow.com', 'fullstory.com',
  'cdn.jsdelivr.net/npm/bootstrap@', // block CDN bootstrap (we inject our own styles)
]

function isAdUrl(url) {
  try {
    const u = new URL(url)
    return AD_DOMAINS.some(d => u.hostname.includes(d) || u.href.includes(d))
  } catch { return false }
}

function setupAdBlocking() {
  // Block ads in the disposablemail partition
  const dmSession = session.fromPartition('persist:disposablemail')
  dmSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (isAdUrl(details.url)) {
      callback({ cancel: true })
    } else {
      callback({})
    }
  })

  // Block new popup windows from the webview
  dmSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const blocked = ['notifications', 'geolocation', 'media', 'openExternal']
    callback(!blocked.includes(permission))
  })
}

function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../build/icon.png'))
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: true,
    },
    titleBarStyle: 'default',
    title: 'Mail',
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }

  // Block popups from webviews
  win.webContents.on('did-attach-webview', (_, webviewContents) => {
    webviewContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })

  return win
}

app.whenReady().then(() => {
  setupAdBlocking()
  setupMailBackend()
  const win = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Zoom controls
  globalShortcut.register('CommandOrControl+=', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.setZoomLevel(w.webContents.getZoomLevel() + 0.5)
  })
  globalShortcut.register('CommandOrControl+Plus', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.setZoomLevel(w.webContents.getZoomLevel() + 0.5)
  })
  globalShortcut.register('CommandOrControl+-', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.setZoomLevel(w.webContents.getZoomLevel() - 0.5)
  })
  globalShortcut.register('CommandOrControl+0', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.setZoomLevel(0)
  })

  if (!isDev) {
    win.once('ready-to-show', () => {
      autoUpdater.checkForUpdates().catch(() => {})
    })
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 30 * 60 * 1000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall(true, false)
})

autoUpdater.on('error', () => {})

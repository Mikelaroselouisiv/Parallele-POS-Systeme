const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { printReceipt } = require('./thermal-printer.cjs');
const localDb = require('./local-db.cjs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function resolveWindowIcon() {
  /** Source unique : monorepo `assets/icons/icon.png` (voir README desktop). */
  const fromRepo = path.join(__dirname, '../../../../assets/icons/icon.png');
  if (fs.existsSync(fromRepo)) return fromRepo;
  const devPublic = path.join(__dirname, '../../public/icon.png');
  const prodDist = path.join(__dirname, '../../dist/icon.png');
  const p = isDev ? devPublic : prodDist;
  return fs.existsSync(p) ? p : undefined;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'POS Frères Basiles',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // DevTools: ouvrir avec Ctrl+Shift+I (Windows/Linux) ou Cmd+Option+I (macOS).
    // Pour les ouvrir au lancement : definir ELECTRON_OPEN_DEVTOOLS=1 avant npm run dev.
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  app.setName('POS Frères Basiles');
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.freresbasiles.pos.desktop');
  }

  await localDb.initLocalDb(app.getPath('userData'));

  ipcMain.handle('localdb:outboxEnqueue', (_e, payload) => localDb.outboxEnqueue(payload));
  ipcMain.handle('localdb:outboxList', () => localDb.outboxList());
  ipcMain.handle('localdb:outboxRemove', (_e, id) => {
    localDb.outboxRemove(id);
  });
  ipcMain.handle('localdb:cacheSet', (_e, { key, json }) => {
    localDb.cacheSet(key, json);
  });
  ipcMain.handle('localdb:cacheGet', (_e, key) => localDb.cacheGet(key));

  ipcMain.handle('printer:print-receipt', async (_event, saleData) => printReceipt(saleData));
  ipcMain.handle('printer:list', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    return win.webContents.getPrintersAsync();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

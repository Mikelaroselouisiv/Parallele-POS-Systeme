const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { printReceipt } = require('./thermal-printer.cjs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'POS Desktop',
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

app.whenReady().then(() => {
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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  printReceipt: (saleData) => ipcRenderer.invoke('printer:print-receipt', saleData),
  listPrinters: () => ipcRenderer.invoke('printer:list'),
});

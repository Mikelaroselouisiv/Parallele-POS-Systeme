const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  printReceipt: (saleData) => ipcRenderer.invoke('printer:print-receipt', saleData),
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  localDb: {
    outboxEnqueue: (payload) => ipcRenderer.invoke('localdb:outboxEnqueue', payload),
    outboxList: () => ipcRenderer.invoke('localdb:outboxList'),
    outboxRemove: (id) => ipcRenderer.invoke('localdb:outboxRemove', id),
    cacheSet: (key, json) => ipcRenderer.invoke('localdb:cacheSet', { key, json }),
    cacheGet: (key) => ipcRenderer.invoke('localdb:cacheGet', key),
  },
});

const { contextBridge, ipcRenderer } = require("electron");

function safeOn(channel, listener) {
  const wrapper = (event, data) => listener(data);
  ipcRenderer.on(channel, wrapper);
  return () => ipcRenderer.removeListener(channel, wrapper);
}

contextBridge.exposeInMainWorld("splashAPI", {
  ready: () => ipcRenderer.send("splash:ready"),
  onVersion: (listener) => safeOn("splash:version", listener),
  onStatus: (listener) => safeOn("splash:status", listener),
  onUpdateAvailable: (listener) => safeOn("splash:update-available", listener),
  onDownloadProgress: (listener) => safeOn("splash:download-progress", listener),
  onUpdateDownloaded: (listener) => safeOn("splash:update-downloaded", listener),
});

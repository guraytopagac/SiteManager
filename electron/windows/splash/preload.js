// Small splash bridge. It exposes the splash:* channels only. They live here, not in
// ipc/channels.js, which belongs to the main window.
const { contextBridge, ipcRenderer } = require("electron");

function safeOn(channel, listener) {
  ipcRenderer.on(channel, (event, data) => listener(data));
}

contextBridge.exposeInMainWorld("splashAPI", {
  onStatus: (listener) => safeOn("splash:status", listener),
  onUpdateAvailable: (listener) => safeOn("splash:update-available", listener),
  onDownloadProgress: (listener) => safeOn("splash:download-progress", listener),
  onUpdateDownloaded: (listener) => safeOn("splash:update-downloaded", listener),
  onClosing: (listener) => safeOn("splash:closing", listener),
  sendRestartChoice: (restart) => ipcRenderer.send("splash:restart-choice", { restart }),
});

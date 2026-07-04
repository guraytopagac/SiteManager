const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");

let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    frame: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => (splashWindow = null));
}

function sendToSplash(channel, data) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(channel, data);
  }
}

function closeSplashAndShowMain(mainWindow) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
    mainWindow.show();
  }
}

function getSplashWindow() {
  return splashWindow;
}

function waitForSplashReady() {
  return new Promise((resolve) => {
    let received = false;
    splashWindow.webContents.once("did-finish-load", () => {
      // Renderer usually sends splash:ready synchronously during load, before
      // this listener is registered — only warn if it genuinely never arrives.
      setTimeout(() => {
        if (received) return;
        console.warn("[Splash] splash:ready not received, continuing via fallback after 300ms.");
        resolve();
      }, 300);
    });
    ipcMain.once("splash:ready", () => {
      received = true;
      resolve();
    });
  });
}

module.exports = { createSplashWindow, sendToSplash, closeSplashAndShowMain, getSplashWindow, waitForSplashReady };

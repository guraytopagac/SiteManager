const { BrowserWindow } = require("electron");
const path = require("path");

let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 310,
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

module.exports = { createSplashWindow, sendToSplash, closeSplashAndShowMain, getSplashWindow };

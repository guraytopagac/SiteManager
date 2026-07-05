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
    alwaysOnTop: false,
    skipTaskbar: false,
    icon: path.join(__dirname, "../../../assets/icon.ico"),
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
    const timeoutId = setTimeout(() => {
      console.warn("[Splash] splash:ready not received, continuing via fallback after 1s.");
      resolve();
    }, 1000);

    ipcMain.once("splash:ready", () => {
      clearTimeout(timeoutId);
      resolve();
    });
  });
}

module.exports = { createSplashWindow, sendToSplash, closeSplashAndShowMain, getSplashWindow, waitForSplashReady };

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
    show: false,
    icon: path.join(__dirname, "../../../assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  splashWindow.once("ready-to-show", () => {
    if (!splashWindow.isDestroyed()) splashWindow.show();
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
  const splash = splashWindow;

  const showMain = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  };

  if (splash && !splash.isDestroyed()) {
    splash.webContents.send("splash:closing");
    splashWindow = null;
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close();
      showMain();
    }, 180);
  } else {
    showMain();
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

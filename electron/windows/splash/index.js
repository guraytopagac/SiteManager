const path = require("path");
const { app, BrowserWindow } = require("electron");

const ICON_PATH = path.join(__dirname, "../../../assets/icon.ico");
const DEV_LINGER_MS = 800;
const MAIN_WINDOW_READY_TIMEOUT_MS = 15000;
const SPLASH_READY_TIMEOUT_MS = 1000;
const CLOSE_FADE_MS = 180;

let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    icon: ICON_PATH,
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

  splashWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`[Splash] Failed to load: ${errorCode} ${errorDescription}`);
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"), { query: { v: app.getVersion() } }).catch(() => {});
  splashWindow.on("closed", () => (splashWindow = null));
}

function sendToSplash(channel, data) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(channel, data);
  }
}

function setSplashStatus(text, isError = false) {
  sendToSplash("splash:status", { text, isError });
}

function setSplashProgress(value, options) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.setProgressBar(value, options);
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
    }, CLOSE_FADE_MS);
  } else {
    showMain();
  }
}

function closeSplashWhenMainReady(mainWindow, isDev) {
  let isRevealed = false;
  let fallbackTimer = null;

  const reveal = (delayMs) => {
    if (isRevealed) return;
    isRevealed = true;
    clearTimeout(fallbackTimer);
    setTimeout(() => closeSplashAndShowMain(mainWindow), delayMs);
  };

  fallbackTimer = setTimeout(() => {
    console.warn(
      `[Splash] ready-to-show not received within ${MAIN_WINDOW_READY_TIMEOUT_MS / 1000}s, revealing the main window anyway.`,
    );
    reveal(0);
  }, MAIN_WINDOW_READY_TIMEOUT_MS);

  mainWindow.once("ready-to-show", () => reveal(isDev ? DEV_LINGER_MS : 0));
}

function getSplashWindow() {
  return splashWindow;
}

function waitForSplashReady() {
  return new Promise((resolve) => {
    if (!splashWindow) return resolve();

    const timeoutId = setTimeout(() => {
      console.warn(
        `[Splash] did-finish-load not received, continuing via fallback after ${SPLASH_READY_TIMEOUT_MS / 1000}s.`,
      );
      resolve();
    }, SPLASH_READY_TIMEOUT_MS);

    splashWindow.webContents.once("did-finish-load", () => {
      clearTimeout(timeoutId);
      resolve();
    });
  });
}

module.exports = {
  createSplashWindow,
  sendToSplash,
  setSplashStatus,
  setSplashProgress,
  closeSplashWhenMainReady,
  getSplashWindow,
  waitForSplashReady,
};

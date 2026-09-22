// The splash window and its whole life: opening, waiting until it is ready, status messages and
// closing. main.js only triggers these. This file also decides when the main window is shown.
const path = require("path");
const { app, BrowserWindow } = require("electron");

const ICON_PATH = path.join(__dirname, "../../../assets/app-icon.ico");
const DEV_LINGER_MS = 800;
const MAIN_WINDOW_READY_TIMEOUT_MS = 15000;
const SPLASH_READY_TIMEOUT_MS = 1000;
// Must be kept equal by hand to the body transition time in splash.css.
const CLOSE_FADE_MS = 180;

let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    // Sized for the restart prompt, the tallest state this window ever shows.
    height: 400,
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

  // The version goes in the query string, not over IPC, so it is there on the first paint.
  splashWindow.loadFile(path.join(__dirname, "splash.html"), { query: { v: app.getVersion() } }).catch(() => {});
  splashWindow.on("closed", () => (splashWindow = null));
}

// Waits for did-finish-load instead of asking the renderer, because a send made before the
// listeners exist is dropped without a trace.
function waitForSplashReady() {
  return new Promise((resolve) => {
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

// The only way in. The two steps always belong together, and a status message sent between them
// would be dropped.
async function openSplash() {
  createSplashWindow();
  await waitForSplashReady();
}

// Exported as is, because autoUpdater sends the other splash:* channels itself.
function sendToSplash(channel, data) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(channel, data);
  }
}

function setSplashStatus(text, isError = false) {
  sendToSplash("splash:status", { text, isError });
}

// Taskbar progress. Only this file touches the window object, so no caller should use
// getSplashWindow().setProgressBar.
function setSplashProgress(value, options) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.setProgressBar(value, options);
  }
}

// Fades the splash out, then maximises and shows the main window. This lives here, not in
// windows/main, because the splash decides when to show it.
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

// Announces what it is waiting for, then waits for ready-to-show with a short extra pause in dev.
// The fallback timer is the safety net. Without it, a renderer that never loads would leave the
// user on a frozen splash.
function closeSplashWhenMainReady(mainWindow, isDev) {
  setSplashStatus("Uygulama yükleniyor");

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

module.exports = {
  openSplash,
  sendToSplash,
  setSplashStatus,
  setSplashProgress,
  closeSplashWhenMainReady,
  getSplashWindow,
};

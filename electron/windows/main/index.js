// The main window. Dev loads the Vite server, a packaged build loads dist/ through electron-serve.
const path = require("path");
const { BrowserWindow, Menu, screen } = require("electron");
const serve = require("electron-serve").default;
const { buildMenu } = require("../../menu");

// Called here on purpose. serve() registers a custom scheme, which only works before the app is
// ready. That is why main.js requires this file at the top.
const loadAppFiles = serve({ directory: path.join(__dirname, "../../../dist") });
const ICON_PATH = path.join(__dirname, "../../../assets/icon.ico");
const DEV_SERVER_URL = "http://localhost:5173/";

let mainWindow = null;

// Created hidden. The splash module is what shows it.
function createMainWindow(isDev) {
  // Limited to the work area, so the window cannot open bigger than the screen. It is maximised
  // when shown, so these are really the restore sizes.
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = Math.min(1200, workAreaSize.width);
  const height = Math.min(800, workAreaSize.height);
  const minWidth = Math.min(1140, workAreaSize.width);
  const minHeight = Math.min(720, workAreaSize.height);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    // No title here, because index.html sets it.
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../../preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // sandbox is off for one reason only. The preload needs CommonJS require.
      sandbox: false,
      webSecurity: true,
    },
  });

  Menu.setApplicationMenu(buildMenu(mainWindow, isDev));

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`[MainWindow] Failed to load: ${errorCode} ${errorDescription}`);
  });

  // The promise is dropped, because did-fail-load already logs the failure. Leaving it open would
  // report the same error again as an unhandled rejection.
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL).catch(() => {});
  } else {
    loadAppFiles(mainWindow).catch(() => {});
  }

  mainWindow.on("closed", () => (mainWindow = null));

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createMainWindow, getMainWindow };

const path = require("path");
const { BrowserWindow, Menu, screen } = require("electron");
const serve = require("electron-serve").default;
const { buildMenu } = require("../../menu");

const loadAppFiles = serve({ directory: path.join(__dirname, "../../../dist") });
const ICON_PATH = path.join(__dirname, "../../../assets/icon.ico");
const DEV_SERVER_URL = "http://localhost:5173/";

let mainWindow = null;

function createMainWindow(isDev) {
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
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../../preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  Menu.setApplicationMenu(buildMenu(mainWindow, isDev));

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`[MainWindow] Failed to load: ${errorCode} ${errorDescription}`);
  });

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

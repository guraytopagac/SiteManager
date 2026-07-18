const path = require("path");
const { BrowserWindow, Menu, screen } = require("electron");
const serve = require("electron-serve").default;
const { buildMenu } = require("../../menu");

const loadURL = serve({ directory: path.join(__dirname, "../../../dist") });
const iconPath = path.join(__dirname, "../../../assets/icon.ico");

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
    title: "Mavikent Site Yönetimi Uygulaması",
    icon: iconPath,
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

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/");
  } else {
    loadURL(mainWindow);
  }

  mainWindow.on("closed", () => (mainWindow = null));

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createMainWindow, getMainWindow };

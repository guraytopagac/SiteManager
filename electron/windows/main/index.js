const path = require("path");
const { BrowserWindow, Menu } = require("electron");
const serve = require("electron-serve").default;
const { buildMenu } = require("../../menu");

const loadURL = serve({ directory: path.join(__dirname, "../../../dist") });

let mainWindow = null;

function createMainWindow(isDev) {
  const iconPath = path.join(__dirname, "../../../assets/icon.ico");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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

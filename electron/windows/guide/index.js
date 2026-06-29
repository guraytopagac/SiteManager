const { BrowserWindow } = require("electron");
const path = require("path");

let guideWin = null;

const ICON_PATH = path.join(__dirname, "../../../src/assets/icons/icon.ico");

function openGuide() {
  if (guideWin && !guideWin.isDestroyed()) {
    guideWin.focus();
    return;
  }
  guideWin = new BrowserWindow({
    width: 1200,
    height: 780,
    title: "Kullanım Kılavuzu",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
    resizable: false,
  });
  guideWin.loadFile(path.join(__dirname, "guide.html"));
  guideWin.on("closed", () => {
    guideWin = null;
  });
}

module.exports = { openGuide };

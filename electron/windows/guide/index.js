const path = require("path");
const { app, BrowserWindow, screen, shell } = require("electron");
const { SUPPORT_EMAIL } = require("../../errorReporting");

const ICON_PATH = path.join(__dirname, "../../../assets/icon.ico");
const BACKGROUND_COLORS = { light: "#f5f7fa", dark: "#16161f" };

let guideWin = null;

async function readAppTheme(parentWindow) {
  if (!parentWindow || parentWindow.isDestroyed()) return "light";
  try {
    const theme = await parentWindow.webContents.executeJavaScript("document.documentElement.dataset.theme");
    return theme === "dark" ? "dark" : "light";
  } catch (err) {
    console.warn("[Guide] Theme read failed:", err);
    return "light";
  }
}

function toggleGuideTheme() {
  if (!guideWin || guideWin.isDestroyed()) return;
  guideWin.webContents
    .executeJavaScript(
      "document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'",
    )
    .catch((err) => console.warn("[Guide] Theme toggle failed:", err));
}

async function openGuide(parentWindow) {
  if (guideWin && !guideWin.isDestroyed()) {
    if (guideWin.isMinimized()) guideWin.restore();
    guideWin.focus();
    return;
  }

  const theme = await readAppTheme(parentWindow);
  const { workAreaSize } = screen.getPrimaryDisplay();

  guideWin = new BrowserWindow({
    width: Math.min(1200, workAreaSize.width),
    height: Math.min(780, workAreaSize.height),
    minWidth: Math.min(900, workAreaSize.width),
    minHeight: Math.min(600, workAreaSize.height),
    icon: ICON_PATH,
    backgroundColor: BACKGROUND_COLORS[theme],
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  guideWin.once("ready-to-show", () => {
    guideWin.show();
  });

  guideWin.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    event.preventDefault();
    shell.openExternal(url).catch((err) => console.warn("[Guide] External open failed:", err));
  });

  guideWin.loadFile(path.join(__dirname, "guide.html"), {
    query: { v: app.getVersion(), mail: SUPPORT_EMAIL, theme },
  });

  guideWin.on("closed", () => {
    guideWin = null;
  });
}

module.exports = { openGuide, toggleGuideTheme };

const { app, ipcMain } = require("electron");
const { openDatabase } = require("../database/db");
const { runMigrations } = require("../database/migrate");
const { checkForUpdatesBeforeStartup } = require("./autoUpdater");
const { initLogging, showFatalError } = require("./errorReporting");
const registerIpcHandlers = require("./ipc");
const { createMainWindow, getMainWindow } = require("./windows/main");
const {
  createSplashWindow,
  sendToSplash,
  closeSplashWhenMainReady,
  getSplashWindow,
  waitForSplashReady,
} = require("./windows/splash");

const isDev = !app.isPackaged;

initLogging(getMainWindow);

app.disableHardwareAcceleration();

function connectDatabase() {
  try {
    return openDatabase();
  } catch (err) {
    console.error("[Main] Database open failed:", err);
    showFatalError(
      "Verilere Ulaşılamadı",
      "Uygulama veri dosyasını açamadı.",
      "Uygulamanın açık başka bir penceresi varsa kapatın ve tekrar deneyin. Sonuç alamazsanız bilgisayarınızı yeniden başlatın.",
    );
    return null;
  }
}

async function startApp() {
  const db = connectDatabase();

  if (!db) {
    app.quit();
    return;
  }

  try {
    createSplashWindow();

    await waitForSplashReady();

    sendToSplash("splash:version", { version: app.getVersion() });

    if (!isDev) {
      sendToSplash("splash:status", { text: "Güncellemeler kontrol ediliyor" });
      await checkForUpdatesBeforeStartup();
    }

    sendToSplash("splash:status", { text: "Veriler hazırlanıyor" });

    runMigrations(db);

    registerIpcHandlers(ipcMain);

    sendToSplash("splash:status", { text: "Uygulama yükleniyor" });

    const mainWindow = createMainWindow(isDev);

    closeSplashWhenMainReady(mainWindow, isDev);
  } catch (err) {
    console.error("[Main] Startup failed:", err);
    showFatalError(
      "Başlatma Hatası",
      "Uygulama başlatılamadı.",
      "Uygulamayı kapatıp yeniden açın. Sonuç alamazsanız bilgisayarınızı yeniden başlatın.",
      getMainWindow(),
    );
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const targetWindow = getMainWindow() || getSplashWindow();
    if (!targetWindow || targetWindow.isDestroyed()) return;
    if (targetWindow.isMinimized()) targetWindow.restore();
    targetWindow.focus();
  });

  app.whenReady().then(startApp);
}

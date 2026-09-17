// App entry point. The order of the startup steps below matters, do not change it.
const { app, ipcMain } = require("electron");
const { openDatabase } = require("../database/db");
const { runMigrations } = require("../database/migrate");
const { runStartupUpdateFlow } = require("./autoUpdater");
const { initLogging, showFatalError } = require("./errorReporting");
const registerIpcHandlers = require("./ipc");
// Must stay at the top of the file. This module calls electron-serve, which registers a
// custom scheme, and that only works before the app is ready.
const { createMainWindow, getMainWindow } = require("./windows/main");
const {
  createSplashWindow,
  setSplashStatus,
  closeSplashWhenMainReady,
  getSplashWindow,
  waitForSplashReady,
} = require("./windows/splash");

const isDev = !app.isPackaged;

// Before the lock below, so a second instance also writes to main.log.
initLogging(getMainWindow);

// On purpose. It prevents drawing problems on old hardware.
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

// Startup steps 3 to 8. Any failure here ends in an error box and app.quit().
async function startApp() {
  const db = connectDatabase();

  if (!db) {
    app.quit();
    return;
  }

  try {
    // This wait is required. A send made before did-finish-load is dropped without a trace.
    createSplashWindow();
    await waitForSplashReady();

    // Runs before the migrations, so a release with a broken migration can still be updated.
    if (!isDev) {
      setSplashStatus("Güncellemeler kontrol ediliyor");
      await runStartupUpdateFlow();
    }

    setSplashStatus("Veriler hazırlanıyor");
    runMigrations(db);
    registerIpcHandlers(ipcMain);

    setSplashStatus("Uygulama yükleniyor");
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

// A second instance quits at once and runs no startup step. Otherwise the migrations would
// run twice on the same database file.
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

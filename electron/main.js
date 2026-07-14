const { app, ipcMain, dialog } = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const { runMigrations } = require("../database/migrate");
const { seedAdminAccount } = require("../database/seed");
const registerIpcHandlers = require("./ipc/index.js");
const { checkForUpdatesBeforeStartup } = require("./autoUpdater");
const { createMainWindow, getMainWindow } = require("./windows/main");
const { createSplashWindow, sendToSplash, closeSplashAndShowMain, waitForSplashReady } = require("./windows/splash");

log.initialize();
log.errorHandler.startCatching();
log.transports.file.maxSize = 5 * 1024 * 1024;
autoUpdater.logger = log;

app.disableHardwareAcceleration();

const isDev = !app.isPackaged;

const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  let db;
  try {
    ({ db } = require("../database/db"));
  } catch (err) {
    log.error("Veritabanı açılamadı", err);
    dialog.showErrorBox("Veritabanı Hatası", `Veritabanı açılamadı:\n${err.message}`);
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

    sendToSplash("splash:status", { text: "Veritabanı hazırlanıyor" });

    runMigrations(db);
    registerIpcHandlers(ipcMain);

    try {
      seedAdminAccount(db);
    } catch (err) {
      log.error("Admin hesabı oluşturulamadı", err);
      dialog.showErrorBox("Başlatma Hatası", `Admin hesabı oluşturulamadı:\n${err.message}`);
      app.quit();
      return;
    }

    sendToSplash("splash:status", { text: "Uygulama yükleniyor" });

    const mainWindow = createMainWindow(isDev);

    mainWindow.once("ready-to-show", () => {
      if (isDev) {
        setTimeout(() => closeSplashAndShowMain(mainWindow), 800);
      } else {
        closeSplashAndShowMain(mainWindow);
      }
    });
  } catch (err) {
    log.error("Uygulama başlatılamadı", err);
    dialog.showErrorBox("Başlatma Hatası", `Uygulama başlatılamadı:\n${err.message}`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());

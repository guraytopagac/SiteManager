const { dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, closeSplashAndShowMain, getSplashWindow } = require("../windows/splash");

function setupAutoUpdater(getMainWindow) {
  autoUpdater.on("checking-for-update", () => console.warn("[Main] Checking for updates..."));

  autoUpdater.on("update-not-available", () => {
    console.warn("[Main] No update available.");
    setTimeout(() => closeSplashAndShowMain(getMainWindow()), 600);
  });

  autoUpdater.on("update-available", (info) => {
    sendToSplash("splash:update-available", { version: info.version });
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`Mavikent Site Yönetimi — Yeni sürüm (v${info.version}) indiriliyor...`);
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
    sendToSplash("splash:download-progress", {
      percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
      mainWindow.setTitle("Mavikent Site Yönetimi Uygulaması");
    }
    sendToSplash("splash:update-downloaded", {});

    const splash = getSplashWindow();
    const parentWindow = splash && !splash.isDestroyed() ? splash : mainWindow;
    try {
      const { response } = await dialog.showMessageBox(parentWindow, {
        type: "info",
        title: "Güncelleme Hazır",
        message: "Güncelleme indirildi.",
        detail: "Uygulamayı yeniden başlatmak ve güncellemeyi yüklemek ister misiniz?",
        buttons: ["Şimdi Yeniden Başlat", "Daha Sonra"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) {
        autoUpdater.quitAndInstall(true, true);
      } else {
        closeSplashAndShowMain(mainWindow);
      }
    } catch (err) {
      console.error("[Main] Update dialog error:", err.message);
      closeSplashAndShowMain(mainWindow);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[Main] Update error:", err.message);
    const mainWindow = getMainWindow();
    closeSplashAndShowMain(mainWindow);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Güncelleme Hatası",
        message: "Güncelleme kontrol edilirken bir hata oluştu.",
        detail: err.message,
        buttons: ["Tamam"],
      });
    }
  });
}

module.exports = { setupAutoUpdater };

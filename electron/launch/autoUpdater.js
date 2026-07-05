const { dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, getSplashWindow } = require("../windows/splash");

const CHECK_TIMEOUT_MS = 20000;

function checkForUpdatesBeforeStartup() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve();
    };

    const timeoutId = setTimeout(() => {
      console.warn("[Main] Update check timed out, continuing startup.");
      finish();
    }, CHECK_TIMEOUT_MS);

    autoUpdater.on("checking-for-update", () => console.warn("[Main] Checking for updates..."));

    autoUpdater.on("update-not-available", () => {
      console.warn("[Main] No update available.");
      finish();
    });

    autoUpdater.on("update-available", (info) => {
      clearTimeout(timeoutId);
      sendToSplash("splash:update-available", { version: info.version });
    });

    autoUpdater.on("download-progress", (progress) => {
      sendToSplash("splash:download-progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on("update-downloaded", async () => {
      sendToSplash("splash:update-downloaded", {});

      try {
        const { response } = await dialog.showMessageBox(getSplashWindow(), {
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
          return;
        }
      } catch (err) {
        console.error("[Main] Update dialog error:", err.message);
      }
      finish();
    });

    autoUpdater.on("error", (err) => {
      console.error("[Main] Update error:", err.message);
      finish();
    });

    autoUpdater.checkForUpdates();
  });
}

module.exports = { checkForUpdatesBeforeStartup };

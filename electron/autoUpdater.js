const { app, dialog, ipcMain } = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, getSplashWindow } = require("./windows/splash");

autoUpdater.logger = log;
autoUpdater.autoInstallOnAppQuit = false;

const CHECK_TIMEOUT_MS = 20000;
const DOWNLOAD_STALL_TIMEOUT_MS = 60000;

const CHECK_TIMED_OUT_MESSAGE = `No response from the update server within ${CHECK_TIMEOUT_MS / 1000}s (offline or slow connection); skipping the update check and booting the app.`;
const DOWNLOAD_STALLED_MESSAGE = `Update download made no progress for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s (connection likely dropped); skipping the update and booting the app.`;

let isUpdateFlowActive = false;

function setTaskbarProgress(value, options) {
  const splash = getSplashWindow();
  if (splash && !splash.isDestroyed()) {
    splash.setProgressBar(value, options);
  }
}

function checkForUpdatesBeforeStartup() {
  return new Promise((resolve) => {
    let finished = false;
    let idleTimeout = null;

    const continueStartup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(idleTimeout);
      for (const [event, handler] of eventHandlers) {
        autoUpdater.removeListener(event, handler);
      }
      resolve();
    };

    const skipUpdate = () => {
      sendToSplash("splash:status", { text: "Güncelleme kontrol edilemedi, atlanıyor", isError: true });
      setTaskbarProgress(1, { mode: "error" });
      continueStartup();
    };

    const waitForProgress = (ms, giveUpReason) => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.warn(`[Updater] ${giveUpReason}`);
        skipUpdate();
      }, ms);
    };

    const eventHandlers = [
      ["update-not-available", continueStartup],
      [
        "error",
        (err) => {
          console.error("[Updater] Update error:", err);
          skipUpdate();
        },
      ],
      [
        "update-available",
        (info) => {
          waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
          sendToSplash("splash:update-available", { version: info.version });
        },
      ],
      [
        "download-progress",
        (progress) => {
          waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
          setTaskbarProgress(progress.percent / 100);
          sendToSplash("splash:download-progress", {
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond,
          });
        },
      ],
      [
        "update-downloaded",
        async () => {
          clearTimeout(idleTimeout);
          setTaskbarProgress(-1);
          sendToSplash("splash:update-downloaded", {});

          const userWantsRestart = await askToRestart();
          if (userWantsRestart) {
            try {
              autoUpdater.quitAndInstall(true, true);
              return;
            } catch (err) {
              console.error("[Updater] Restart to install failed:", err);
            }
          }
          continueStartup();
        },
      ],
    ];

    for (const [event, handler] of eventHandlers) {
      autoUpdater.on(event, handler);
    }

    waitForProgress(CHECK_TIMEOUT_MS, CHECK_TIMED_OUT_MESSAGE);
    autoUpdater.checkForUpdates().catch(() => {});
  });
}

function askToRestart() {
  return new Promise((resolve) => {
    const splash = getSplashWindow();
    if (!splash || splash.isDestroyed()) {
      resolve(false);
      return;
    }

    const finish = (restart) => {
      ipcMain.removeListener("splash:restart-choice", onChoice);
      splash.removeListener("closed", onClosed);
      resolve(restart);
    };
    const onChoice = (event, data) => finish(Boolean(data && data.restart));
    const onClosed = () => finish(false);

    ipcMain.once("splash:restart-choice", onChoice);
    splash.once("closed", onClosed);
  });
}

async function checkForUpdatesOnDemand(mainWindow) {
  if (isUpdateFlowActive) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme",
      message: "Güncelleme işlemi sürüyor.",
      detail: "Mevcut kontrol veya indirme tamamlanana kadar bekleyin.",
      buttons: ["Tamam"],
    });
    return;
  }

  isUpdateFlowActive = true;
  let isDownloading = false;

  try {
    const timedOut = new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(CHECK_TIMED_OUT_MESSAGE)), CHECK_TIMEOUT_MS);
    });

    const result = await Promise.race([autoUpdater.checkForUpdates(), timedOut]);

    if (!result?.downloadPromise) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Güncelleme",
        message: "Uygulamanız güncel.",
        detail: `Kullandığınız sürüm (${app.getVersion()}) şu an mevcut olan en son sürüm.`,
        buttons: ["Tamam"],
      });
      return;
    }

    isDownloading = true;
    const download = result.downloadPromise.then(
      () => null,
      (err) => err,
    );

    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme Bulundu",
      message: "Yeni sürüm indiriliyor.",
      detail: "İndirme tamamlandığında yeniden başlatma seçeneği sunulacak.",
      buttons: ["Tamam"],
    });

    const downloadError = await download;
    if (downloadError) throw downloadError;

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme Hazır",
      message: "Yeni sürüm indirildi.",
      detail: "Güncellemenin uygulanması için uygulamanın yeniden başlatılması gerekiyor.",
      buttons: ["Şimdi Yeniden Başlat", "Daha Sonra"],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  } catch (err) {
    console.error("[Updater] On-demand update check failed:", err);
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Güncelleme",
      message: isDownloading ? "Güncelleme indirilemedi." : "Güncelleme kontrolü şu an kullanılamıyor.",
      detail: "İnternet bağlantınızı kontrol edip daha sonra tekrar deneyin.",
      buttons: ["Tamam"],
    });
  } finally {
    isUpdateFlowActive = false;
  }
}

module.exports = { checkForUpdatesBeforeStartup, checkForUpdatesOnDemand };

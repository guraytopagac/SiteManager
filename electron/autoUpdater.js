// The only file that uses electron-updater. main.js and menu.js never import it.
const { app, dialog, ipcMain } = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, setSplashStatus, setSplashProgress, getSplashWindow } = require("./windows/splash");

autoUpdater.logger = log;
// Not the package default. A downloaded update installs only when the user picks restart.
autoUpdater.autoInstallOnAppQuit = false;
// No web installer target is built, so leaving this off only earns a deprecation warning.
autoUpdater.disableWebInstaller = true;
// A delta download rebuilds the installer from a cached base file and its block map, and the two drift
// apart whenever the app is installed outside the updater, which restarts the transfer as a full one.
autoUpdater.disableDifferentialDownload = true;

const CHECK_TIMEOUT_MS = 20000;
const DOWNLOAD_STALL_TIMEOUT_MS = 60000;

// Facts only. What follows a timeout differs per flow, so the consequence is written
// where it happens instead of being baked into these strings.
const CHECK_TIMED_OUT_MESSAGE = `No response from the update server within ${CHECK_TIMEOUT_MS / 1000}s.`;
const DOWNLOAD_STALLED_MESSAGE = `Update download made no progress for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s.`;

let isUpdateFlowActive = false;

// Startup flow, packaged builds only. It uses events and talks to the splash window.
// Every path resolves, so a slow or missing connection cannot block startup.
function runStartupUpdateFlow() {
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

    // Every give-up path lands here, so this is where the outcome gets logged. The error
    // path passes no reason, because it has already logged the error object itself.
    const skipUpdate = (reason) => {
      if (reason) console.warn(`[Updater] ${reason} Skipping the update and continuing startup.`);
      setSplashStatus("Güncelleme kontrol edilemedi, atlanıyor", true);
      setSplashProgress(1, { mode: "error" });
      continueStartup();
    };

    const waitForProgress = (ms, giveUpReason) => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => skipUpdate(giveUpReason), ms);
    };

    const onError = (err) => {
      console.error("[Updater] Update error:", err);
      skipUpdate();
    };

    const onUpdateAvailable = (info) => {
      waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
      sendToSplash("splash:update-available", { version: info.version });
    };

    const onDownloadProgress = (progress) => {
      waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
      setSplashProgress(progress.percent / 100);
      sendToSplash("splash:download-progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    };

    const onUpdateDownloaded = async () => {
      clearTimeout(idleTimeout);
      setSplashProgress(-1);
      sendToSplash("splash:update-downloaded", {});

      const userWantsRestart = await askToRestart();
      if (userWantsRestart) {
        try {
          autoUpdater.quitAndInstall(true, true);
          return;
        } catch (err) {
          // Startup has to go on, or the splash would stay open for good.
          console.error("[Updater] Restart to install failed:", err);
        }
      }
      continueStartup();
    };

    const eventHandlers = [
      ["update-not-available", continueStartup],
      ["error", onError],
      ["update-available", onUpdateAvailable],
      ["download-progress", onDownloadProgress],
      ["update-downloaded", onUpdateDownloaded],
    ];

    for (const [event, handler] of eventHandlers) {
      autoUpdater.on(event, handler);
    }

    waitForProgress(CHECK_TIMEOUT_MS, CHECK_TIMED_OUT_MESSAGE);
    // The rejection is dropped on purpose. The same failure also arrives through the error event.
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

// Menu flow. It uses no event listeners, because autoUpdater events are global and the
// startup flow removes all of them.
async function runOnDemandUpdateFlow(mainWindow) {
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
    // Our own timeout. The one in electron-updater waits for a socket event Electron never sends,
    // so a stuck request would leave isUpdateFlowActive true for good.
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

    // Handled before the box opens and read after it closes. Otherwise a failure while the box is
    // open would show up as an unhandled rejection.
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

module.exports = { runOnDemandUpdateFlow, runStartupUpdateFlow };

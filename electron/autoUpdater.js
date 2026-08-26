// The only file that uses electron-updater. main.js and menu.js never import it.
const { app, dialog, ipcMain } = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, setSplashStatus, setSplashProgress, getSplashWindow } = require("./windows/splash");

autoUpdater.logger = log;
// Not the package default. A downloaded update installs only when the user picks restart.
autoUpdater.autoInstallOnAppQuit = false;

const CHECK_TIMEOUT_MS = 20000;
const DOWNLOAD_STALL_TIMEOUT_MS = 60000;

const CHECK_TIMED_OUT_MESSAGE = `No response from the update server within ${CHECK_TIMEOUT_MS / 1000}s (offline or slow connection); skipping the update check and booting the app.`;
const DOWNLOAD_STALLED_MESSAGE = `Update download made no progress for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s (connection likely dropped); skipping the update and booting the app.`;

let isUpdateFlowActive = false;

// Startup flow, packaged builds only. It uses events and talks to the splash window.
// Every path resolves, so a slow or missing connection cannot block startup.
function runStartupUpdateFlow() {
  return new Promise((resolve) => {
    let finished = false;
    let idleTimeout = null;

    // The one exit point. Removes every listener once, then lets startup go on.
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
      setSplashStatus("Güncelleme kontrol edilemedi, atlanıyor", true);
      setSplashProgress(1, { mode: "error" });
      continueStartup();
    };

    // Restarted on every sign of progress, and gives up after ms of silence.
    const waitForProgress = (ms, giveUpReason) => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.warn(`[Updater] ${giveUpReason}`);
        skipUpdate();
      }, ms);
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

    // The splash asks the restart question. Saying no keeps the current version for this session.
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

// Returns the restart choice made in the splash, or false if that window is gone.
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

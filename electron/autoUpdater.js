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

// The endings the event bridge below can report. The one that happened is an `outcome`.
const UPDATE_OUTCOMES = { NONE: "none", DOWNLOADED: "downloaded", SKIPPED: "skipped" };

let isUpdateFlowActive = false;

// Startup flow, packaged builds only. The bridge below reports an outcome and this decides what it
// means, so every path here is plain sequential code that always returns.
async function runStartupUpdateFlow() {
  setSplashStatus("Güncellemeler kontrol ediliyor");

  const outcome = await watchForUpdate();

  if (outcome === UPDATE_OUTCOMES.SKIPPED) {
    setSplashStatus("Güncelleme kontrol edilemedi, atlanıyor", true);
    setSplashProgress(1, { mode: "error" });
    return;
  }
  if (outcome !== UPDATE_OUTCOMES.DOWNLOADED) return;

  setSplashProgress(-1);
  sendToSplash("splash:update-downloaded", {});

  if (!(await askToRestart())) return;

  try {
    autoUpdater.quitAndInstall(true, true);
  } catch (err) {
    // Startup has to go on, or the splash would stay open for good.
    console.error("[Updater] Restart to install failed:", err);
  }
}

// Turns the update events into a single outcome and streams the progress to the splash on the way.
// Every path settles and unbinds, so a slow or missing connection cannot block startup.
function watchForUpdate() {
  return new Promise((resolve) => {
    let idleTimeout = null;
    // Binding through the helper below is what guarantees every listener is also removed.
    const listeners = [];

    const listen = (event, handler) => {
      listeners.push([event, handler]);
      autoUpdater.on(event, handler);
    };

    const finish = (outcome) => {
      clearTimeout(idleTimeout);
      for (const [event, handler] of listeners) autoUpdater.removeListener(event, handler);
      resolve(outcome);
    };

    // Re-armed on every sign of life, so a download that keeps moving never trips it.
    const waitForProgress = (ms, giveUpReason) => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.warn(`[Updater] ${giveUpReason} Skipping the update and continuing startup.`);
        finish(UPDATE_OUTCOMES.SKIPPED);
      }, ms);
    };

    listen("update-not-available", () => finish(UPDATE_OUTCOMES.NONE));
    listen("update-downloaded", () => finish(UPDATE_OUTCOMES.DOWNLOADED));

    // The error object is logged here, so the give-up path does not have to repeat it.
    listen("error", (err) => {
      console.error("[Updater] Update error:", err);
      finish(UPDATE_OUTCOMES.SKIPPED);
    });

    listen("update-available", (info) => {
      waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
      sendToSplash("splash:update-available", { version: info.version });
    });

    listen("download-progress", (progress) => {
      waitForProgress(DOWNLOAD_STALL_TIMEOUT_MS, DOWNLOAD_STALLED_MESSAGE);
      setSplashProgress(progress.percent / 100);
      sendToSplash("splash:download-progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    waitForProgress(CHECK_TIMEOUT_MS, CHECK_TIMED_OUT_MESSAGE);
    // The rejection is dropped on purpose. The same failure also arrives through the error event.
    autoUpdater.checkForUpdates().catch(() => {});
  });
}

// The question is asked inside the splash window, so a splash that is already gone means no.
function askToRestart() {
  const splash = getSplashWindow();
  if (!splash || splash.isDestroyed()) return Promise.resolve(false);

  return new Promise((resolve) => {
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

// Every box in the menu flow is an OK-only notice, except the restart prompt.
function notifyUpdate(parentWindow, { type = "info", title = "Güncelleme", message, detail }) {
  return dialog.showMessageBox(parentWindow, { type, title, message, detail, buttons: ["Tamam"] });
}

// Menu flow. It uses no event listeners, because autoUpdater events are global and the
// startup flow removes all of them.
async function runOnDemandUpdateFlow(mainWindow) {
  if (isUpdateFlowActive) {
    await notifyUpdate(mainWindow, {
      message: "Güncelleme işlemi sürüyor.",
      detail: "Mevcut kontrol veya indirme tamamlanana kadar bekleyin.",
    });
    return;
  }

  isUpdateFlowActive = true;
  let isDownloading = false;
  let checkTimer = null;

  try {
    // The limit is ours. The one in electron-updater waits for a socket event Electron never
    // sends, so a stuck request would leave the flow flag true for good.
    const timedOut = new Promise((_resolve, reject) => {
      checkTimer = setTimeout(() => reject(new Error(CHECK_TIMED_OUT_MESSAGE)), CHECK_TIMEOUT_MS);
    });
    const result = await Promise.race([autoUpdater.checkForUpdates(), timedOut]);

    if (!result?.downloadPromise) {
      await notifyUpdate(mainWindow, {
        message: "Uygulamanız güncel.",
        detail: `Kullandığınız sürüm (${app.getVersion()}) şu an mevcut olan en son sürüm.`,
      });
      return;
    }

    isDownloading = true;
    // The rejection handler goes on before the box opens. A failure that lands while a modal
    // is open would otherwise surface as an unhandled rejection.
    const downloadFailure = result.downloadPromise.then(
      () => null,
      (err) => err,
    );

    await notifyUpdate(mainWindow, {
      title: "Güncelleme Bulundu",
      message: "Yeni sürüm indiriliyor.",
      detail: "İndirme tamamlandığında yeniden başlatma seçeneği sunulacak.",
    });

    const downloadError = await downloadFailure;
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

    if (response === 0) autoUpdater.quitAndInstall(true, true);
  } catch (err) {
    console.error("[Updater] On-demand update check failed:", err);
    await notifyUpdate(mainWindow, {
      type: "warning",
      message: isDownloading ? "Güncelleme indirilemedi." : "Güncelleme kontrolü şu an kullanılamıyor.",
      detail: "İnternet bağlantınızı kontrol edip daha sonra tekrar deneyin.",
    });
  } finally {
    clearTimeout(checkTimer);
    isUpdateFlowActive = false;
  }
}

module.exports = { runOnDemandUpdateFlow, runStartupUpdateFlow };

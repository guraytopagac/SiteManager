const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { sendToSplash, getSplashWindow } = require("./windows/splash");

const CHECK_TIMEOUT_MS = 20000;
const DOWNLOAD_STALL_TIMEOUT_MS = 60000;

const DOWNLOAD_STALLED_MESSAGE = `Update download made no progress for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000}s (connection likely dropped); skipping the update and booting the app.`;

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

    const waitForProgress = (ms, giveUpReason) => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.warn(`[Main] ${giveUpReason}`);
        sendToSplash("splash:status", { text: "Güncelleme kontrol edilemedi, atlanıyor", isError: true });
        setTaskbarProgress(1, { mode: "error" });
        continueStartup();
      }, ms);
    };

    const continueStartup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(idleTimeout);
      for (const [event, handler] of eventHandlers) {
        autoUpdater.removeListener(event, handler);
      }
      resolve();
    };

    const eventHandlers = [
      [
        "update-not-available",
        () => {
          setTaskbarProgress(-1);
          continueStartup();
        },
      ],
      [
        "error",
        (err) => {
          console.error("[Main] Update error:", err.message);
          sendToSplash("splash:status", { text: "Güncelleme kontrol edilemedi, atlanıyor", isError: true });
          setTaskbarProgress(1, { mode: "error" });
          continueStartup();
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
            autoUpdater.quitAndInstall(true, true);
            return;
          }
          continueStartup();
        },
      ],
    ];

    for (const [event, handler] of eventHandlers) {
      autoUpdater.on(event, handler);
    }

    waitForProgress(
      CHECK_TIMEOUT_MS,
      `No response from the update server within ${CHECK_TIMEOUT_MS / 1000}s (offline or slow connection); skipping the update check and booting the app.`,
    );
    autoUpdater.checkForUpdates();
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

module.exports = { checkForUpdatesBeforeStartup };

// The only backup IPC entry point. Restore has none, because it restarts the app.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { getMainWindow } = require("../../windows/main");
const { noValidation } = require("../shared/validate");
const backupService = require("./service");

function registerBackupHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "backup");

  // silent: true returns the result instead of showing a box. The Profile page button needs that.
  handle(
    CH.BACKUP.RUN,
    noValidation,
    () => backupService.runBackup(getMainWindow(), { silent: true }),
    "Yedek alınamadı.",
  );
}

module.exports = registerBackupHandlers;

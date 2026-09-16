// Backup IPC entry points. Restore on a working install has none and stays in the menu, because it
// replaces data the user is looking at. The setup screen has its own, since there is no data yet.
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
  handle(
    CH.BACKUP.RESTORE_ON_SETUP,
    noValidation,
    () => backupService.restoreOnSetup(getMainWindow()),
    "Dosya yüklenemedi.",
  );
}

module.exports = registerBackupHandlers;

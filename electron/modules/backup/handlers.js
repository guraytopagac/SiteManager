const { CHANNELS: CH } = require("../../ipc/channels");
const { getMainWindow } = require("../../windows/main");
const { createHandle } = require("../shared/safeHandler");
const { noValidation } = require("../shared/validate");
const backupService = require("./service");

function registerBackupHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "backup");

  handle(
    CH.BACKUP.RUN,
    noValidation,
    () => backupService.runBackup(getMainWindow(), { silent: true }),
    "Yedek alınamadı.",
  );
}

module.exports = registerBackupHandlers;

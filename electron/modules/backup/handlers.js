const { CHANNELS: CH } = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const { getMainWindow } = require("../../windows/main");
const backupService = require("./service");

const safeHandler = createSafeHandler("backup");

function registerBackupHandlers(ipcMain) {
  ipcMain.handle(
    CH.BACKUP.RUN,
    safeHandler(
      CH.BACKUP.RUN,
      () => backupService.runBackup(getMainWindow(), { silent: true }),
      "Yedek alınamadı.",
    ),
  );
}

module.exports = registerBackupHandlers;

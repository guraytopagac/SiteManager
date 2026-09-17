const registrars = [
  require("../modules/apartment/handlers"),
  require("../modules/auth/handlers"),
  require("../modules/backup/handlers"),
  require("../modules/building/handlers"),
  require("../modules/dashboard/handlers"),
  require("../modules/dues/handlers"),
  require("../modules/financial/handlers"),
  require("../modules/report/handlers"),
  require("../modules/resident/handlers"),
  require("../modules/severance/handlers"),
  require("../modules/system/handlers"),
];

function registerIpcHandlers(ipcMain) {
  for (const register of registrars) register(ipcMain);
}

module.exports = registerIpcHandlers;

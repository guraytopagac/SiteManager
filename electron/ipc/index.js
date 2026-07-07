const registerApartmentHandlers = require("../modules/apartment/handlers");
const registerAuthHandlers = require("../modules/auth/handlers");
const registerDashboardHandlers = require("../modules/dashboard/handlers");
const registerDuesHandlers = require("../modules/dues/handlers");
const registerFinancialHandlers = require("../modules/financial/handlers");
const registerReportHandlers = require("../modules/report/handlers");
const registerResidentHandlers = require("../modules/resident/handlers");
const registerSystemHandlers = require("../modules/system/handlers");

function registerIpcHandlers(ipcMain) {
  registerApartmentHandlers(ipcMain);
  registerAuthHandlers(ipcMain);
  registerDashboardHandlers(ipcMain);
  registerDuesHandlers(ipcMain);
  registerFinancialHandlers(ipcMain);
  registerReportHandlers(ipcMain);
  registerResidentHandlers(ipcMain);
  registerSystemHandlers(ipcMain);
}

module.exports = registerIpcHandlers;

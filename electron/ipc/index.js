const registerAuthHandlers = require("./handlers/auth.handlers");
const registerApartmentHandlers = require("./handlers/apartment.handlers");
const registerDashboardHandlers = require("./handlers/dashboard.handlers");
const registerFinancialHandlers = require("./handlers/financial.handlers");
const registerDuesHandlers = require("./handlers/dues.handlers");
const registerSystemHandlers = require("./handlers/system.handlers");
const registerReportHandlers = require("./handlers/report.handlers");

function registerIpcHandlers(ipcMain) {
  registerAuthHandlers(ipcMain);
  registerApartmentHandlers(ipcMain);
  registerDashboardHandlers(ipcMain);
  registerFinancialHandlers(ipcMain);
  registerDuesHandlers(ipcMain);
  registerSystemHandlers(ipcMain);
  registerReportHandlers(ipcMain);
}

module.exports = registerIpcHandlers;

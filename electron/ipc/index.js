const registerAuthHandlers = require("./auth.handlers");
const registerApartmentHandlers = require("./apartment.handlers");
const registerDashboardHandlers = require("./dashboard.handlers");
const registerFinancialHandlers = require("./financial.handlers");
const registerDuesHandlers = require("./dues.handlers");
const registerSystemHandlers = require("./system.handlers");
const registerReportHandlers = require("./report.handlers");

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

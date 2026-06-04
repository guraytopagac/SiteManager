const registerAuthHandlers = require('./auth.handlers');
const registerApartmentHandlers = require('./apartment.handlers');
const registerDashboardHandlers = require('./dashboard.handlers');
const registerFinancialHandlers = require('./financial.handlers');

function registerIpcHandlers(ipcMain) {
    registerAuthHandlers(ipcMain);
    registerApartmentHandlers(ipcMain);
    registerDashboardHandlers(ipcMain);
    registerFinancialHandlers(ipcMain);
}

module.exports = registerIpcHandlers;

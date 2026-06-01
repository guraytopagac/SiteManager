const registerAuthHandlers = require('./auth.handlers');
const registerApartmentHandlers = require('./apartment.handlers');
const registerDashboardHandlers = require('./dashboard.handlers');

function registerIpcHandlers(ipcMain) {
    registerAuthHandlers(ipcMain);
    registerApartmentHandlers(ipcMain);
    registerDashboardHandlers(ipcMain);
}

module.exports = registerIpcHandlers;

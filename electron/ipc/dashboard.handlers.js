const dashboardService = require('../services/dashboard.service');

function registerDashboardHandlers(ipcMain) {
    ipcMain.handle('get-stats', () => dashboardService.getStats());
}

module.exports = registerDashboardHandlers;

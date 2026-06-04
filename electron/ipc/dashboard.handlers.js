const dashboardService = require('../services/dashboard.service');

function registerDashboardHandlers(ipcMain) {
    ipcMain.handle('get-stats', (event, managerId) => dashboardService.getStats(managerId));
}

module.exports = registerDashboardHandlers;

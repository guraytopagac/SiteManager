const dashboardService = require("../services/dashboard.service");

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle("get-stats", async (event, managerId) => {
    try {
      return await dashboardService.getStats(managerId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = registerDashboardHandlers;

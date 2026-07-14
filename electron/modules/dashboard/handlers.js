const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const dashboardService = require("./service");

const safeHandler = createSafeHandler("dashboard");

function validateGetStatsData(managerId) {
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  return null;
}

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle(
    CH.DASHBOARD.GET_STATS,
    safeHandler(CH.DASHBOARD.GET_STATS, (managerId) => {
      const error = validateGetStatsData(managerId);
      if (error) {
        return error;
      }
      return dashboardService.getStats(managerId);
    }),
  );
}

module.exports = registerDashboardHandlers;

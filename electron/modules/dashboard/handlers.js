const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const dashboardService = require("./service");

const safeHandler = createSafeHandler("dashboard");

function validateGetStatsData(buildingId) {
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  return null;
}

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle(
    CH.DASHBOARD.GET_STATS,
    safeHandler(CH.DASHBOARD.GET_STATS, (buildingId) => {
      const error = validateGetStatsData(buildingId);
      if (error) {
        return error;
      }
      return dashboardService.getStats(buildingId);
    }),
  );
}

module.exports = registerDashboardHandlers;

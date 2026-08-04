const { CHANNELS: CH } = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const dashboardService = require("./service");

const safeHandler = createSafeHandler("dashboard");

function validateGetStatsData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (!Number.isInteger(payload.buildingId) || payload.buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  return null;
}

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle(
    CH.DASHBOARD.GET_STATS,
    safeHandler(CH.DASHBOARD.GET_STATS, (payload) => {
      const error = validateGetStatsData(payload);
      if (error) {
        return error;
      }
      return dashboardService.getStats(payload.buildingId);
    }),
  );
}

module.exports = registerDashboardHandlers;

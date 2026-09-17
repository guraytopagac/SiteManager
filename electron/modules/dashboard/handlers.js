const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { validateBuildingScope } = require("../shared/validate");
const dashboardService = require("./service");

function registerDashboardHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "dashboard");

  handle(CH.DASHBOARD.GET_STATS, validateBuildingScope, dashboardService.getStats);
}

module.exports = registerDashboardHandlers;

// Dashboard IPC entry point. Its only field is buildingId, so the shared scope check is enough.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { validateBuildingScope } = require("../shared/validate");
const dashboardService = require("./service");

function registerDashboardHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "dashboard");

  handle(CH.DASHBOARD.GET_STATS, validateBuildingScope, dashboardService.getStats);
}

module.exports = registerDashboardHandlers;

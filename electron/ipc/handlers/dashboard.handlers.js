const dashboardService = require("../../services/dashboard.service");
const CH = require("../channels");

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle(CH.DASHBOARD.GET_STATS, (event, managerId) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return dashboardService.getStats(managerId);
    } catch (err) {
      console.error("[Dashboard] getStats handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerDashboardHandlers;

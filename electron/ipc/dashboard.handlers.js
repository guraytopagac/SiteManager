const dashboardService = require("../services/dashboard.service");

function registerDashboardHandlers(ipcMain) {
  ipcMain.handle("get-stats", async (event, managerId) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return await dashboardService.getStats(managerId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerDashboardHandlers;

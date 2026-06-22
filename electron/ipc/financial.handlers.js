const financialService = require("../services/financial.service");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle("add-income", async (event, data) => {
    if (!data?.amount || data.amount <= 0) {
      return { success: false, message: "Geçersiz gelir tutarı." };
    }
    if (!data?.manager_id || !data?.date) {
      return { success: false, message: "Eksik alan: yönetici veya tarih bilgisi." };
    }
    try {
      return await financialService.addIncome(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("add-expense", async (event, data) => {
    if (!data?.amount || data.amount <= 0) {
      return { success: false, message: "Geçersiz gider tutarı." };
    }
    if (!data?.manager_id || !data?.date) {
      return { success: false, message: "Eksik alan: yönetici veya tarih bilgisi." };
    }
    try {
      return await financialService.addExpense(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("get-transactions", async (event, managerId) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return await financialService.getTransactions(managerId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerFinancialHandlers;

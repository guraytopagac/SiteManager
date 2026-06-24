const financialService = require("../services/financial.service");
const CH = require("./channels");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle(CH.FINANCIAL.ADD_INCOME, async (event, data) => {
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

  ipcMain.handle(CH.FINANCIAL.ADD_EXPENSE, async (event, data) => {
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

  ipcMain.handle(CH.FINANCIAL.GET_TRANSACTIONS, async (event, { managerId, startDate, endDate } = {}) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return await financialService.getTransactions(managerId, { startDate, endDate });
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.CANCEL_INCOME, async (event, { id, managerId, reason, cancelledBy }) => {
    if (!id || typeof id !== "number") return { success: false, message: "Geçersiz kayıt ID." };
    if (!managerId || typeof managerId !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    if (!reason?.trim()) return { success: false, message: "İptal nedeni zorunludur." };
    if (!cancelledBy || typeof cancelledBy !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    try {
      return await financialService.cancelIncome(id, managerId, reason.trim(), cancelledBy);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.CANCEL_EXPENSE, async (event, { id, managerId, reason, cancelledBy }) => {
    if (!id || typeof id !== "number") return { success: false, message: "Geçersiz kayıt ID." };
    if (!managerId || typeof managerId !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    if (!reason?.trim()) return { success: false, message: "İptal nedeni zorunludur." };
    if (!cancelledBy || typeof cancelledBy !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    try {
      return await financialService.cancelExpense(id, managerId, reason.trim(), cancelledBy);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerFinancialHandlers;

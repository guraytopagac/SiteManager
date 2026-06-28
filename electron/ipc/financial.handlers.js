const financialService = require("../services/financial.service");
const CH = require("./channels");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle(CH.FINANCIAL.ADD_INCOME, (event, data) => {
    if (typeof data?.amount !== "number" || data.amount <= 0) {
      return { success: false, message: "Geçersiz gelir tutarı." };
    }
    if (!data?.manager_id || !data?.date) {
      return { success: false, message: "Eksik alan: yönetici veya tarih bilgisi." };
    }
    if (!data?.description?.trim()) {
      return { success: false, message: "Açıklama alanı zorunludur." };
    }
    try {
      return financialService.addIncome(data);
    } catch (err) {
      console.error("[Financial] addIncome handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.ADD_EXPENSE, (event, data) => {
    if (typeof data?.amount !== "number" || data.amount <= 0) {
      return { success: false, message: "Geçersiz gider tutarı." };
    }
    if (!data?.manager_id || !data?.date) {
      return { success: false, message: "Eksik alan: yönetici veya tarih bilgisi." };
    }
    if (!data?.description?.trim()) {
      return { success: false, message: "Açıklama alanı zorunludur." };
    }
    try {
      return financialService.addExpense(data);
    } catch (err) {
      console.error("[Financial] addExpense handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.GET_TRANSACTIONS, (event, { managerId }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return financialService.getTransactions(managerId);
    } catch (err) {
      console.error("[Financial] getTransactions handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.CANCEL_INCOME, (event, { id, userId, reason }) => {
    if (!id || typeof id !== "number") return { success: false, message: "Geçersiz kayıt ID." };
    if (!userId || typeof userId !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    if (!reason?.trim()) return { success: false, message: "İptal nedeni zorunludur." };
    try {
      return financialService.cancelIncome(id, userId, reason.trim());
    } catch (err) {
      console.error("[Financial] cancelIncome handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.FINANCIAL.CANCEL_EXPENSE, (event, { id, userId, reason }) => {
    if (!id || typeof id !== "number") return { success: false, message: "Geçersiz kayıt ID." };
    if (!userId || typeof userId !== "number") return { success: false, message: "Geçersiz kullanıcı ID." };
    if (!reason?.trim()) return { success: false, message: "İptal nedeni zorunludur." };
    try {
      return financialService.cancelExpense(id, userId, reason.trim());
    } catch (err) {
      console.error("[Financial] cancelExpense handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerFinancialHandlers;

const duesService = require("../services/dues.service");

const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

function registerDuesHandlers(ipcMain) {
  ipcMain.handle("get-dues-for-month", async (event, { managerId, year, month }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    try {
      return await duesService.getDuesForMonth(managerId, year, month);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("record-payment", async (event, { dueId, paymentData }) => {
    if (!dueId || typeof dueId !== "number") {
      return { success: false, message: "Geçersiz aidat ID." };
    }
    if (!paymentData?.amount || paymentData.amount <= 0) {
      return { success: false, message: "Geçersiz ödeme tutarı." };
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentData?.payment_method)) {
      return { success: false, message: "Geçersiz ödeme yöntemi." };
    }
    try {
      return await duesService.recordPayment(dueId, paymentData);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("cancel-payment", async (event, { paymentId, reason }) => {
    if (!paymentId || typeof paymentId !== "number") {
      return { success: false, message: "Geçersiz ödeme ID." };
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return { success: false, message: "İptal nedeni zorunludur." };
    }
    try {
      return await duesService.cancelPayment(paymentId, reason);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("get-payment-history", async (event, { dueId }) => {
    if (!dueId || typeof dueId !== "number") {
      return { success: false, message: "Geçersiz aidat ID." };
    }
    try {
      return await duesService.getPaymentHistory(dueId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerDuesHandlers;

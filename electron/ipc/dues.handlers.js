const duesService = require("../services/dues.service");
const CH = require("./channels");

const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

function registerDuesHandlers(ipcMain) {
  ipcMain.handle(CH.DUES.GET_FOR_MONTH, async (event, { managerId, year, month }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!year || !month || typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    try {
      return await duesService.getDuesForMonth(managerId, year, month);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.RECORD_PAYMENT, async (event, { dueId, paymentData }) => {
    if (!dueId || typeof dueId !== "number") {
      return { success: false, message: "Geçersiz aidat ID." };
    }
    if (!paymentData?.amount || paymentData.amount <= 0) {
      return { success: false, message: "Geçersiz ödeme tutarı." };
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentData?.payment_method)) {
      return { success: false, message: "Geçersiz ödeme yöntemi." };
    }
    if (!paymentData?.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(paymentData.payment_date)) {
      return { success: false, message: "Geçersiz ödeme tarihi." };
    }
    if (!paymentData?.collected_by || typeof paymentData.collected_by !== "number") {
      return { success: false, message: "Geçersiz tahsilat kullanıcısı." };
    }
    try {
      return await duesService.recordPayment(dueId, paymentData);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.CANCEL_PAYMENT, async (event, { paymentId, managerId, reason, cancelledBy }) => {
    if (!paymentId || typeof paymentId !== "number") {
      return { success: false, message: "Geçersiz ödeme ID." };
    }
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return { success: false, message: "İptal nedeni zorunludur." };
    }
    if (!cancelledBy || typeof cancelledBy !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return await duesService.cancelPayment(paymentId, managerId, reason.trim(), cancelledBy);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.GET_PAYMENT_HISTORY, async (event, { dueId }) => {
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

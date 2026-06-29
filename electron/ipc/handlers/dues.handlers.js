const duesService = require("../../services/dues.service");
const CH = require("../channels");

const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

function registerDuesHandlers(ipcMain) {
  ipcMain.handle(CH.DUES.GET_FOR_MONTH, (event, { managerId, year, month }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!year || !month || typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    try {
      return duesService.getDuesForMonth(managerId, year, month);
    } catch (err) {
      console.error("[Dues] getDuesForMonth handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.RECORD_PAYMENT, (event, { apartmentId, year, month, paymentData }) => {
    if (!apartmentId || typeof apartmentId !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    if (!year || !month || typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    if (!paymentData?.amount || paymentData.amount <= 0) {
      return { success: false, message: "Geçersiz ödeme tutarı." };
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentData.payment_method)) {
      return { success: false, message: "Geçersiz ödeme yöntemi." };
    }
    if (!paymentData.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(paymentData.payment_date)) {
      return { success: false, message: "Geçersiz ödeme tarihi." };
    }
    if (!paymentData.collected_by || typeof paymentData.collected_by !== "number") {
      return { success: false, message: "Geçersiz tahsilat kullanıcısı." };
    }
    try {
      return duesService.recordPayment(apartmentId, year, month, paymentData);
    } catch (err) {
      console.error("[Dues] recordPayment handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.CANCEL_PAYMENT, (event, { paymentId, userId, reason }) => {
    if (!paymentId || typeof paymentId !== "number") {
      return { success: false, message: "Geçersiz ödeme ID." };
    }
    if (!userId || typeof userId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return { success: false, message: "İptal nedeni zorunludur." };
    }
    if (reason.trim().length > 500) {
      return { success: false, message: "İptal nedeni en fazla 500 karakter olabilir." };
    }
    try {
      return duesService.cancelPayment(paymentId, userId, reason.trim());
    } catch (err) {
      console.error("[Dues] cancelPayment handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.DUES.GET_PAYMENT_HISTORY, (event, { dueId }) => {
    if (!dueId || typeof dueId !== "number") {
      return { success: false, message: "Geçersiz aidat ID." };
    }
    try {
      return duesService.getPaymentHistory(dueId);
    } catch (err) {
      console.error("[Dues] getPaymentHistory handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerDuesHandlers;

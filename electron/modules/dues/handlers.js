const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const duesService = require("./service");

const safeHandler = createSafeHandler("dues");

const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];
const PAYMENT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYMENT_AMOUNT = 1000000;
const MAX_NOTE_LENGTH = 500;
const MAX_REASON_LENGTH = 300;

function validateGetForMonthData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { buildingId, year, month } = payload;
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, message: "Geçersiz tarih bilgisi." };
  }
  return null;
}

function validateRecordPaymentData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { apartmentId, buildingId, year, month, paymentData } = payload;
  if (!Number.isInteger(apartmentId) || apartmentId <= 0) {
    return { success: false, message: "Geçersiz daire ID." };
  }
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, message: "Geçersiz tarih bilgisi." };
  }
  if (typeof paymentData?.amount !== "number" || !Number.isFinite(paymentData.amount) || paymentData.amount <= 0) {
    return { success: false, message: "Geçersiz ödeme tutarı." };
  }
  if (paymentData.amount > MAX_PAYMENT_AMOUNT) {
    return { success: false, message: "Ödeme tutarı 1.000.000₺'yi aşamaz." };
  }
  if (paymentData.note != null && (typeof paymentData.note !== "string" || paymentData.note.length > MAX_NOTE_LENGTH)) {
    return { success: false, message: "Not en fazla 500 karakter olabilir." };
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentData.payment_method)) {
    return { success: false, message: "Geçersiz ödeme yöntemi." };
  }
  if (
    !paymentData.payment_date ||
    !PAYMENT_DATE_RE.test(paymentData.payment_date) ||
    paymentData.payment_date < "2000-01-01"
  ) {
    return { success: false, message: "Geçersiz ödeme tarihi." };
  }
  if (!Number.isInteger(paymentData.collected_by) || paymentData.collected_by <= 0) {
    return { success: false, message: "Geçersiz tahsilat kullanıcısı." };
  }
  return null;
}

function validateCancelPaymentData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { paymentId, buildingId, userId, reason } = payload;
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return { success: false, message: "Geçersiz ödeme ID." };
  }
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return { success: false, message: "İptal nedeni zorunludur." };
  }
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return { success: false, message: "İptal nedeni en fazla 300 karakter olabilir." };
  }
  return null;
}

function validateGetPaymentHistoryData(payload) {
  if (!Number.isInteger(payload?.dueId) || payload.dueId <= 0) {
    return { success: false, message: "Geçersiz aidat ID." };
  }
  if (!Number.isInteger(payload.buildingId) || payload.buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  return null;
}

function registerDuesHandlers(ipcMain) {
  ipcMain.handle(
    CH.DUES.GET_FOR_MONTH,
    safeHandler(CH.DUES.GET_FOR_MONTH, (payload) => {
      const error = validateGetForMonthData(payload);
      if (error) {
        return error;
      }
      return duesService.getDuesForMonth(payload.buildingId, payload.year, payload.month);
    }),
  );

  ipcMain.handle(
    CH.DUES.RECORD_PAYMENT,
    safeHandler(CH.DUES.RECORD_PAYMENT, (payload) => {
      const error = validateRecordPaymentData(payload);
      if (error) {
        return error;
      }
      return duesService.recordPayment(
        payload.apartmentId,
        payload.buildingId,
        payload.year,
        payload.month,
        payload.paymentData,
      );
    }),
  );

  ipcMain.handle(
    CH.DUES.CANCEL_PAYMENT,
    safeHandler(CH.DUES.CANCEL_PAYMENT, (payload) => {
      const error = validateCancelPaymentData(payload);
      if (error) {
        return error;
      }
      return duesService.cancelPayment(payload.paymentId, payload.buildingId, payload.userId, payload.reason.trim());
    }),
  );

  ipcMain.handle(
    CH.DUES.GET_PAYMENT_HISTORY,
    safeHandler(CH.DUES.GET_PAYMENT_HISTORY, (payload) => {
      const error = validateGetPaymentHistoryData(payload);
      if (error) {
        return error;
      }
      return duesService.getPaymentHistory(payload.dueId, payload.buildingId);
    }),
  );
}

module.exports = registerDuesHandlers;

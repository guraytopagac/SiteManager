const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../shared/safeHandler");
const {
  fail,
  isDateInRange,
  isIsoDate,
  isValidMonth,
  isValidYear,
  validateBuildingScope,
  validateId,
  validatePayload,
} = require("../shared/validate");
const duesService = require("./service");

const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

function validatePeriod(payload) {
  const { year, month } = payload;
  if (!isValidYear(year) || !isValidMonth(month)) {
    return fail("Geçersiz tarih bilgisi.");
  }
  return null;
}

function validateCancelReason(payload) {
  if (typeof payload.reason !== "string" || !payload.reason.trim()) {
    return fail("İptal nedeni zorunludur.");
  }
  payload.reason = payload.reason.trim();
  if (payload.reason.length > 300) {
    return fail("İptal nedeni en fazla 300 karakter olabilir.");
  }
  return null;
}

function validatePaymentData(paymentData) {
  const payloadError = validatePayload(paymentData);
  if (payloadError) {
    return payloadError;
  }
  if (!Number.isFinite(paymentData.amount) || paymentData.amount <= 0) {
    return fail("Geçersiz ödeme tutarı.");
  }
  if (paymentData.amount > 1000000) {
    return fail("Ödeme tutarı 1.000.000₺'yi aşamaz.");
  }
  if (paymentData.note != null) {
    if (typeof paymentData.note !== "string") {
      return fail("Not en fazla 500 karakter olabilir.");
    }
    paymentData.note = paymentData.note.trim();
    if (paymentData.note.length > 500) {
      return fail("Not en fazla 500 karakter olabilir.");
    }
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentData.payment_method)) {
    return fail("Geçersiz ödeme yöntemi.");
  }
  if (!isIsoDate(paymentData.payment_date) || !isDateInRange(paymentData.payment_date)) {
    return fail("Geçersiz ödeme tarihi.");
  }
  return validateId(paymentData.collected_by, "tahsilat kullanıcısı");
}

function registerDuesHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "dues");

  handle(
    CH.DUES.GET_FOR_MONTH,
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload),
    duesService.getDuesForMonth,
  );
  handle(
    CH.DUES.RECORD_PAYMENT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.apartmentId, "daire ID") ??
      validatePeriod(payload) ??
      validatePaymentData(payload.paymentData),
    duesService.recordPayment,
  );
  handle(
    CH.DUES.CANCEL_PAYMENT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.paymentId, "ödeme ID") ??
      validateId(payload.userId, "kullanıcı ID") ??
      validateCancelReason(payload),
    duesService.cancelPayment,
  );
  handle(
    CH.DUES.GET_PAYMENT_HISTORY,
    (payload) => validateBuildingScope(payload) ?? validateId(payload.dueId, "aidat ID"),
    duesService.getPaymentHistory,
  );
}

module.exports = registerDuesHandlers;

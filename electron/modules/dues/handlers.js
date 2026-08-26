// Dues IPC entry points. Every channel that takes a period rejects a future one.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/handler");
const {
  fail,
  isValidDate,
  validateBuildingScope,
  validateCancelReason,
  validateId,
  validatePayload,
  validatePeriod,
} = require("../shared/validate");
const duesService = require("./service");

// Same list as the schema CHECK and PAYMENT_METHOD_LABELS in src/pages/Apartments/constants.js.
const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];
const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönem için aidat işlemi yapılamaz.";

// The payment form arrives as a nested object, so it gets its own payload check. The earliest
// allowed month is checked in the service, which knows when the apartment was created.
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
      return fail("Geçersiz not.");
    }
    paymentData.note = paymentData.note.trim();
    if (paymentData.note.length > 500) {
      return fail("Not en fazla 500 karakter olabilir.");
    }
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentData.payment_method)) {
    return fail("Geçersiz ödeme yöntemi.");
  }
  if (!isValidDate(paymentData.payment_date)) {
    return fail("Geçersiz ödeme tarihi.");
  }
  return validateId(paymentData.collected_by, "tahsilat kullanıcısı");
}

function registerDuesHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "dues");

  handle(
    CH.DUES.GET_FOR_MONTH,
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload, FUTURE_PERIOD_MESSAGE),
    duesService.getDuesForMonth,
  );
  handle(
    CH.DUES.RECORD_PAYMENT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.apartmentId, "daire ID") ??
      validatePeriod(payload, FUTURE_PERIOD_MESSAGE) ??
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

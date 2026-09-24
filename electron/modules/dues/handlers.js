// Dues IPC entry points. Every channel that takes a period rejects a future one, except the prepayment,
// which may reach eleven months ahead.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { formatPersonName } = require("../shared/personName");
const {
  PAYMENT_METHODS,
  fail,
  isValidDate,
  isValidFileName,
  isValidMonth,
  isValidYear,
  validateBuildingScope,
  validateCancelReason,
  validateCashAccount,
  validateId,
  validatePayload,
  validatePeriod,
} = require("../shared/validate");
const { currentPeriod, toPeriod, trToday } = require("../shared/trTime");
const duesService = require("./service");

const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönem için aidat işlemi yapılamaz.";

// The two charges a payment can settle. Same list as the due_type CHECK and the DUE_TYPES table in
// dues/service.js. A payment has to name one, it is never guessed from the payload.
const DUE_TYPES = ["regular", "investment"];

// Accepted receipt types, keyed by extension, the same list as the CHECK on receipt_name. A file also has
// to start with its type's signature, so a renamed executable never reaches the database or the shell.
const JPEG_SIGNATURE = [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }];
const RECEIPT_SIGNATURES = {
  pdf: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  jpg: JPEG_SIGNATURE,
  jpeg: JPEG_SIGNATURE,
  png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  webp: [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
};

function validateReceipt(receipt) {
  if (receipt == null) {
    return null;
  }
  const payloadError = validatePayload(receipt);
  if (payloadError) {
    return payloadError;
  }
  if (typeof receipt.name !== "string") {
    return fail("Geçersiz dekont dosyası.");
  }
  receipt.name = receipt.name.trim();
  if (!receipt.name) {
    return fail("Dekont dosya adı boş olamaz.");
  }
  if (!isValidFileName(receipt.name)) {
    return fail("Dekont dosya adı geçersiz.");
  }
  const signatures = RECEIPT_SIGNATURES[receipt.name.split(".").pop().toLowerCase()];
  if (!signatures) {
    return fail("Dekont yalnızca PDF, JPG, PNG veya WEBP dosyası olabilir.");
  }
  if (!(receipt.data instanceof Uint8Array) || receipt.data.byteLength === 0) {
    return fail("Dekont dosyası okunamadı.");
  }
  if (receipt.data.byteLength > 5 * 1024 * 1024) {
    return fail("Dekont dosyası 5 MB'ı aşamaz.");
  }
  const matchesType = signatures.every(({ offset, bytes }) =>
    bytes.every((byte, index) => receipt.data[offset + index] === byte),
  );
  return matchesType ? null : fail("Dekont dosyasının içeriği uzantısıyla uyuşmuyor.");
}

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
  return validatePaymentDetails(paymentData);
}

// Everything on the form except the amount. A prepayment shares it, but its amount is worked out by the
// service from the months it covers and a receipt is never attached to twelve rows at once.
function validatePaymentDetails(paymentData) {
  if (paymentData.note != null) {
    if (typeof paymentData.note !== "string") {
      return fail("Geçersiz not.");
    }
    paymentData.note = paymentData.note.trim();
    if (paymentData.note.length > 500) {
      return fail("Not en fazla 500 karakter olabilir.");
    }
  }
  // Optional: the account owner is the collector unless the form names someone else.
  if (paymentData.collector_name != null) {
    if (typeof paymentData.collector_name !== "string") {
      return fail("Geçersiz tahsil eden bilgisi.");
    }
    paymentData.collector_name = formatPersonName(paymentData.collector_name);
    if (paymentData.collector_name.length > 60) {
      return fail("Tahsil eden en fazla 60 karakter olabilir.");
    }
  }
  if (!PAYMENT_METHODS.includes(paymentData.payment_method)) {
    return fail("Geçersiz ödeme yöntemi.");
  }
  if (!isValidDate(paymentData.payment_date)) {
    return fail("Geçersiz ödeme tarihi.");
  }
  // Rejected by day, the same way the income and expense channels do it.
  if (paymentData.payment_date > trToday()) {
    return fail("İleri bir tarih seçilemez.");
  }
  return validateId(paymentData.collected_by, "tahsilat kullanıcısı") ?? validateReceipt(paymentData.receipt);
}

function validateDueType(value) {
  return DUE_TYPES.includes(value) ? null : fail("Geçersiz aidat türü.");
}

// A prepayment and its refund both cover a range of months, each end checked here. These are the two channels
// allowed past the current period, and only by eleven months, so the window is twelve months with the current
// one.
function validateAdvanceMonth(year, month) {
  if (!isValidYear(year) || !isValidMonth(month)) {
    return fail("Geçersiz dönem bilgisi.");
  }
  const period = toPeriod(year, month);
  if (period < currentPeriod()) {
    return fail("Peşin ödeme işlemi bu aydan önceki bir ayı kapsayamaz.");
  }
  if (period > currentPeriod() + 11) {
    return fail("Peşin ödeme işlemi bu ay dahil en fazla 12 ayı kapsayabilir.");
  }
  return null;
}

function validateAdvanceRange(payload) {
  return (
    validateAdvanceMonth(payload.startYear, payload.startMonth) ??
    validateAdvanceMonth(payload.endYear, payload.endMonth) ??
    (toPeriod(payload.startYear, payload.startMonth) > toPeriod(payload.endYear, payload.endMonth)
      ? fail("Başlangıç ayı bitiş ayından sonra olamaz.")
      : null)
  );
}

// Who got the money back is asked every time, since the payer may have been the tenant or the owner.
function validateRefundData(refund) {
  const payloadError = validatePayload(refund);
  if (payloadError) {
    return payloadError;
  }
  if (typeof refund.payee_name !== "string") {
    return fail("İade edilen kişi girilmelidir.");
  }
  refund.payee_name = formatPersonName(refund.payee_name);
  if (refund.payee_name.length < 2) {
    return fail("İade edilen kişi girilmelidir.");
  }
  if (refund.payee_name.length > 100) {
    return fail("İade edilen kişi en fazla 100 karakter olabilir.");
  }
  if (!isValidDate(refund.date)) {
    return fail("Geçersiz iade tarihi.");
  }
  if (refund.date > trToday()) {
    return fail("İleri bir tarih seçilemez.");
  }
  return validateCashAccount(refund.account);
}

function validatePrepaymentData(paymentData) {
  const payloadError = validatePayload(paymentData);
  if (payloadError) {
    return payloadError;
  }
  if (paymentData.receipt != null) {
    return fail("Peşin ödemeye dekont eklenemez.");
  }
  return validatePaymentDetails(paymentData);
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
      validateDueType(payload.dueType) ??
      validatePaymentData(payload.paymentData),
    duesService.recordPayment,
  );
  handle(
    CH.DUES.GET_PREPAYMENT_PLAN,
    (payload) => validateBuildingScope(payload) ?? validateId(payload.apartmentId, "daire ID"),
    duesService.getPrepaymentPlan,
  );
  handle(
    CH.DUES.RECORD_PREPAYMENT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.apartmentId, "daire ID") ??
      validateAdvanceRange(payload) ??
      validatePrepaymentData(payload.paymentData),
    duesService.recordPrepayment,
  );
  handle(
    CH.DUES.REFUND_PREPAYMENT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.apartmentId, "daire ID") ??
      validateId(payload.userId, "kullanıcı ID") ??
      validateAdvanceRange(payload) ??
      validateRefundData(payload.refund),
    duesService.refundPrepayment,
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
  handle(
    CH.DUES.ATTACH_RECEIPT,
    (payload) =>
      validateBuildingScope(payload) ??
      validateId(payload.paymentId, "ödeme ID") ??
      (payload.receipt == null ? fail("Dekont dosyası seçilmedi.") : validateReceipt(payload.receipt)),
    duesService.attachReceipt,
  );
  handle(
    CH.DUES.OPEN_RECEIPT,
    (payload) => validateBuildingScope(payload) ?? validateId(payload.paymentId, "ödeme ID"),
    duesService.openReceipt,
    "Dekont açılamadı.",
  );
}

module.exports = registerDuesHandlers;

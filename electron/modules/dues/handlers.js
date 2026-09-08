// Dues IPC entry points. Every channel that takes a period rejects a future one.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const {
  fail,
  isValidDate,
  isValidFileName,
  validateBuildingScope,
  validateCancelReason,
  validateId,
  validatePayload,
  validatePeriod,
} = require("../shared/validate");
const duesService = require("./service");

// Same list as the schema CHECK and PAYMENT_METHOD_LABELS in
// src/pages/Dues/DuesModals/PaymentModal.jsx.
const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];
const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönem için aidat işlemi yapılamaz.";

// Accepted receipt types, keyed by extension. The same extensions are a CHECK on receipt_name.
// A file also has to start with the signature of its type, so a renamed executable is refused
// before it reaches the database or the temp file openReceipt hands to the shell.
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

// The receipt is optional wherever it is accepted, so a missing one is not an error here.
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
    paymentData.collector_name = paymentData.collector_name.trim();
    if (paymentData.collector_name.length > 60) {
      return fail("Tahsil eden en fazla 60 karakter olabilir.");
    }
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentData.payment_method)) {
    return fail("Geçersiz ödeme yöntemi.");
  }
  if (!isValidDate(paymentData.payment_date)) {
    return fail("Geçersiz ödeme tarihi.");
  }
  return validateId(paymentData.collected_by, "tahsilat kullanıcısı") ?? validateReceipt(paymentData.receipt);
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

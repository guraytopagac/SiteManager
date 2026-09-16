// Financial IPC entry points, for income and expense entered by hand and the documents printed from them.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { formatPersonName } = require("../shared/personName");
const { trToday } = require("../shared/trTime");
const {
  PAYMENT_METHODS,
  fail,
  isValidDate,
  isValidMonth,
  isValidYear,
  validateBuildingScope,
  validateCancelReason,
  validateId,
} = require("../shared/validate");
const financialService = require("./service");

// The dues category is valid in the schema but not here, because only recordPayment may write it.
// Both lists match the schema CHECKs and the selects on the matching pages.
const MANUAL_INCOME_CATEGORIES = ["rent", "parking", "utility_share", "special_fee", "penalty", "other"];
const EXPENSE_CATEGORIES = ["maintenance", "cleaning", "utility", "heating", "staff", "other"];

// An income prints a collection receipt, an expense prints an expense voucher.
const DOCUMENT_TYPES = ["income", "expense"];

// Trims, turns an empty description into null and sets the default category, so the service
// needs no fallback of its own.
function normalizeFinancialData(payload) {
  if (typeof payload.description === "string") {
    payload.description = payload.description.trim();
  }
  if (payload.description == null || payload.description === "") {
    payload.description = null;
  }
  if (typeof payload.category === "string") {
    payload.category = payload.category.trim();
  }
  if (payload.category == null || payload.category === "") {
    payload.category = "other";
  }
}

// Trims an optional text field and turns an empty or missing value into null, so a cleared field
// clears the column.
function normalizeOptionalText(payload, field) {
  if (typeof payload[field] === "string") {
    payload[field] = payload[field].trim();
  }
  if (payload[field] == null || payload[field] === "") {
    payload[field] = null;
  }
}

function validateOptionalText(value, maxLength, message) {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.length <= maxLength ? null : fail(message);
}

// Field checks shared by income and expense. The limits match the CHECK constraints.
function validateRecordFields(payload, allowedCategories) {
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return fail("Geçersiz tutar.");
  }
  if (payload.amount > 1000000) {
    return fail("Tutar 1.000.000₺'yi aşamaz.");
  }
  if (!isValidDate(payload.date)) {
    return fail("Geçersiz tarih.");
  }
  // A later date is rejected by day here, while the period channels compare whole months.
  if (payload.date > trToday()) {
    return fail("İleri bir tarih seçilemez.");
  }
  // The description is optional, so only a value that is present has to be a string of the right length.
  if (payload.description != null) {
    if (typeof payload.description !== "string") {
      return fail("Geçersiz açıklama.");
    }
    if (payload.description.length > 500) {
      return fail("Açıklama en fazla 500 karakter olabilir.");
    }
  }
  if (!allowedCategories.includes(payload.category)) {
    return fail("Geçersiz kategori.");
  }
  return null;
}

function validatePaymentMethod(value) {
  return PAYMENT_METHODS.includes(value) ? null : fail("Geçersiz ödeme şekli.");
}

// A manual income has to say how it was paid, because its receipt has no payment row to read it from.
function validateIncomeFields(payload) {
  normalizeFinancialData(payload);
  if (payload.category === "dues") {
    return fail("Aidat gelirleri elle eklenemez; daire üzerinden tahsil edilir.");
  }
  return validateRecordFields(payload, MANUAL_INCOME_CATEGORIES) ?? validatePaymentMethod(payload.payment_method);
}

function validateExpenseFields(payload) {
  normalizeFinancialData(payload);
  return validateRecordFields(payload, EXPENSE_CATEGORIES);
}

// Checks the optional period of getTransactions, where null means all time. Not the same as
// validatePeriod in shared/validate.js, which reads the payload fields and rejects a future period.
function validateOptionalPeriod(period) {
  if (period == null) {
    return null;
  }
  if (typeof period !== "object" || Array.isArray(period)) {
    return fail("Geçersiz dönem.");
  }
  if (!isValidYear(period.year)) {
    return fail("Geçersiz yıl.");
  }
  if (!isValidMonth(period.month)) {
    return fail("Geçersiz ay.");
  }
  return null;
}

// A cancel call carries two ids. buildingId says which building, userId says who did it.
function validateCancelScope(payload) {
  return (
    validateBuildingScope(payload) ?? validateId(payload.id, "kayıt ID") ?? validateId(payload.userId, "kullanıcı ID")
  );
}

function validateDocumentScope(payload) {
  return (
    validateBuildingScope(payload) ??
    validateId(payload.id, "kayıt ID") ??
    (DOCUMENT_TYPES.includes(payload.type) ? null : fail("Geçersiz belge türü."))
  );
}

// A receipt asks for the payer's name only. The payment method was chosen when the income or the
// dues payment was entered, so it is printed from the record and never written from here.
function validateReceiptFields(payload) {
  normalizeOptionalText(payload, "payer_name");
  if (typeof payload.payer_name === "string") {
    payload.payer_name = formatPersonName(payload.payer_name);
  }
  return validateOptionalText(payload.payer_name, 60, "Ad soyad en fazla 60 karakter olabilir.");
}

// The vendor name is formatted like a person's name even when it is a firm, so a name typed with
// Caps Lock on still prints properly. The price is an abbreviation such as "ABC" becoming "Abc".
function validateVoucherFields(payload) {
  normalizeOptionalText(payload, "vendor_name");
  normalizeOptionalText(payload, "vendor_address");
  if (typeof payload.vendor_name === "string") {
    payload.vendor_name = formatPersonName(payload.vendor_name);
  }
  return (
    validateOptionalText(payload.vendor_name, 100, "İşi yapanın adı en fazla 100 karakter olabilir.") ??
    validateOptionalText(payload.vendor_address, 300, "Adres en fazla 300 karakter olabilir.")
  );
}

function validateDocumentFields(payload) {
  return payload.type === "income" ? validateReceiptFields(payload) : validateVoucherFields(payload);
}

function registerFinancialHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "financial");

  handle(
    CH.FINANCIAL.ADD_INCOME,
    (payload) => validateBuildingScope(payload) ?? validateIncomeFields(payload),
    financialService.addIncome,
  );
  handle(
    CH.FINANCIAL.ADD_EXPENSE,
    (payload) => validateBuildingScope(payload) ?? validateExpenseFields(payload),
    financialService.addExpense,
  );
  handle(
    CH.FINANCIAL.GET_TRANSACTIONS,
    (payload) => validateBuildingScope(payload) ?? validateOptionalPeriod(payload.period),
    financialService.getTransactions,
  );
  handle(
    CH.FINANCIAL.CANCEL_INCOME,
    (payload) => validateCancelScope(payload) ?? validateCancelReason(payload),
    financialService.cancelIncome,
  );
  handle(
    CH.FINANCIAL.CANCEL_EXPENSE,
    (payload) => validateCancelScope(payload) ?? validateCancelReason(payload),
    financialService.cancelExpense,
  );
  handle(CH.FINANCIAL.GET_DOCUMENT, validateDocumentScope, financialService.getDocument);
  handle(
    CH.FINANCIAL.SAVE_DOCUMENT_INFO,
    (payload) => validateDocumentScope(payload) ?? validateDocumentFields(payload),
    financialService.saveDocumentInfo,
  );
}

module.exports = registerFinancialHandlers;

// Financial IPC entry points, for income and expense entered by hand.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { trToday } = require("../shared/trTime");
const {
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
const MANUAL_INCOME_CATEGORIES = ["rent", "parking", "donation", "other"];
const EXPENSE_CATEGORIES = ["maintenance", "cleaning", "utility", "staff", "other"];

// Trims and sets the default category, so the service needs no fallback of its own.
function normalizeFinancialData(payload) {
  if (typeof payload.description === "string") {
    payload.description = payload.description.trim();
  }
  if (typeof payload.category === "string") {
    payload.category = payload.category.trim();
  }
  if (payload.category == null || payload.category === "") {
    payload.category = "other";
  }
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
  if (typeof payload.description !== "string" || !payload.description) {
    return fail("Açıklama alanı zorunludur.");
  }
  if (payload.description.length > 500) {
    return fail("Açıklama en fazla 500 karakter olabilir.");
  }
  if (!allowedCategories.includes(payload.category)) {
    return fail("Geçersiz kategori.");
  }
  return null;
}

function validateIncomeFields(payload) {
  normalizeFinancialData(payload);
  if (payload.category === "dues") {
    return fail("Aidat gelirleri elle eklenemez; daire üzerinden tahsil edilir.");
  }
  return validateRecordFields(payload, MANUAL_INCOME_CATEGORIES);
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
}

module.exports = registerFinancialHandlers;

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
} = require("../shared/validate");
const financialService = require("./service");

const MANUAL_INCOME_CATEGORIES = ["rent", "parking", "donation", "other"];
const EXPENSE_CATEGORIES = ["maintenance", "cleaning", "utility", "staff", "other"];

const TRIMMED_FIELDS = ["description", "category"];

function normalizeFinancialData(payload) {
  for (const field of TRIMMED_FIELDS) {
    if (typeof payload[field] === "string") {
      payload[field] = payload[field].trim();
    }
  }
}

function validateRecordFields(payload, allowedCategories) {
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return fail("Geçersiz tutar.");
  }
  if (payload.amount > 1000000) {
    return fail("Tutar 1.000.000₺'yi aşamaz.");
  }
  if (!payload.date) {
    return fail("Eksik alan: tarih bilgisi.");
  }
  if (!isIsoDate(payload.date) || !isDateInRange(payload.date)) {
    return fail("Geçersiz tarih.");
  }
  if (typeof payload.description !== "string" || !payload.description) {
    return fail("Açıklama alanı zorunludur.");
  }
  if (payload.description.length > 500) {
    return fail("Açıklama en fazla 500 karakter olabilir.");
  }
  if (payload.category != null && payload.category !== "" && !allowedCategories.includes(payload.category)) {
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

function validatePeriod(period) {
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
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload.period),
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

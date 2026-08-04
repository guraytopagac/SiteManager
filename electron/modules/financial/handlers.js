const { CHANNELS: CH } = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const financialService = require("./service");

const safeHandler = createSafeHandler("financial");

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = "2000-01-01";
const MAX_DATE = "2100-12-31";
const MAX_AMOUNT = 1000000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REASON_LENGTH = 300;
const MANUAL_INCOME_CATEGORIES = ["rent", "parking", "donation", "other"];
const EXPENSE_CATEGORIES = ["maintenance", "cleaning", "utility", "staff", "other"];

const TRIMMED_FIELDS = ["description", "category"];
function normalizeFinancialData(data) {
  for (const field of TRIMMED_FIELDS) {
    if (typeof data[field] === "string") {
      data[field] = data[field].trim();
    }
  }
  return data;
}

function validateAmountDescriptionCategory(data, allowedCategories) {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, message: "Geçersiz tutar." };
  }
  if (data.amount > MAX_AMOUNT) {
    return { success: false, message: "Tutar 1.000.000₺'yi aşamaz." };
  }
  if (!Number.isInteger(data.buildingId) || data.buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!data.date) {
    return { success: false, message: "Eksik alan: tarih bilgisi." };
  }
  if (
    typeof data.date !== "string" ||
    !ISO_DATE_RE.test(data.date) ||
    data.date < MIN_DATE ||
    data.date > MAX_DATE
  ) {
    return { success: false, message: "Geçersiz tarih." };
  }
  const description = typeof data.description === "string" ? data.description : "";
  if (!description) {
    return { success: false, message: "Açıklama alanı zorunludur." };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { success: false, message: "Açıklama en fazla 500 karakter olabilir." };
  }
  if (data.category != null && data.category !== "") {
    if (!allowedCategories.includes(data.category)) {
      return { success: false, message: "Geçersiz kategori." };
    }
  }
  return null;
}

function validateIncomeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  normalizeFinancialData(data);
  if (data.category === "dues") {
    return { success: false, message: "Aidat gelirleri elle eklenemez; daire üzerinden tahsil edilir." };
  }
  return validateAmountDescriptionCategory(data, MANUAL_INCOME_CATEGORIES);
}

function validateExpenseData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  normalizeFinancialData(data);
  return validateAmountDescriptionCategory(data, EXPENSE_CATEGORIES);
}

function validateGetTransactionsData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { buildingId, period } = payload;
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (period == null) {
    return null;
  }
  if (typeof period !== "object" || Array.isArray(period)) {
    return { success: false, message: "Geçersiz dönem." };
  }
  if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2100) {
    return { success: false, message: "Geçersiz yıl." };
  }
  if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    return { success: false, message: "Geçersiz ay." };
  }
  return null;
}

function validateCancelData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { id, buildingId, userId, reason } = payload;
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Geçersiz kayıt ID." };
  }
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  if (!reason?.trim()) {
    return { success: false, message: "İptal nedeni zorunludur." };
  }
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return { success: false, message: "İptal nedeni en fazla 300 karakter olabilir." };
  }
  return null;
}

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle(
    CH.FINANCIAL.ADD_INCOME,
    safeHandler(CH.FINANCIAL.ADD_INCOME, (data) => {
      const error = validateIncomeData(data);
      if (error) {
        return error;
      }
      return financialService.addIncome(data);
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.ADD_EXPENSE,
    safeHandler(CH.FINANCIAL.ADD_EXPENSE, (data) => {
      const error = validateExpenseData(data);
      if (error) {
        return error;
      }
      return financialService.addExpense(data);
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.GET_TRANSACTIONS,
    safeHandler(CH.FINANCIAL.GET_TRANSACTIONS, (payload) => {
      const error = validateGetTransactionsData(payload);
      if (error) {
        return error;
      }
      return financialService.getTransactions(payload.buildingId, payload.period);
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.CANCEL_INCOME,
    safeHandler(CH.FINANCIAL.CANCEL_INCOME, (payload) => {
      const error = validateCancelData(payload);
      if (error) {
        return error;
      }
      return financialService.cancelIncome(payload.id, payload.buildingId, payload.userId, payload.reason.trim());
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.CANCEL_EXPENSE,
    safeHandler(CH.FINANCIAL.CANCEL_EXPENSE, (payload) => {
      const error = validateCancelData(payload);
      if (error) {
        return error;
      }
      return financialService.cancelExpense(payload.id, payload.buildingId, payload.userId, payload.reason.trim());
    }),
  );
}

module.exports = registerFinancialHandlers;

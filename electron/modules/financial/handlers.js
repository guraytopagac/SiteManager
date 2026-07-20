const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const financialService = require("./service");

const safeHandler = createSafeHandler("financial");

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1000000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REASON_LENGTH = 300;
const INCOME_CATEGORIES = ["dues", "other"];
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
  if (!Number.isInteger(data.managerId) || data.managerId <= 0) {
    return { success: false, message: "Geçersiz site yöneticisi ID." };
  }
  if (!data.date) {
    return { success: false, message: "Eksik alan: tarih bilgisi." };
  }
  if (typeof data.date !== "string" || !ISO_DATE_RE.test(data.date) || data.date < "2000-01-01") {
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
  return validateAmountDescriptionCategory(data, INCOME_CATEGORIES);
}

function validateExpenseData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  normalizeFinancialData(data);
  return validateAmountDescriptionCategory(data, EXPENSE_CATEGORIES);
}

function validateGetTransactionsData(managerId) {
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  return null;
}

function validateCancelData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { id, userId, reason } = payload;
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Geçersiz kayıt ID." };
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
    safeHandler(CH.FINANCIAL.GET_TRANSACTIONS, (managerId) => {
      const error = validateGetTransactionsData(managerId);
      if (error) {
        return error;
      }
      return financialService.getTransactions(managerId);
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.CANCEL_INCOME,
    safeHandler(CH.FINANCIAL.CANCEL_INCOME, (payload) => {
      const error = validateCancelData(payload);
      if (error) {
        return error;
      }
      return financialService.cancelIncome(payload.id, payload.userId, payload.reason.trim());
    }),
  );

  ipcMain.handle(
    CH.FINANCIAL.CANCEL_EXPENSE,
    safeHandler(CH.FINANCIAL.CANCEL_EXPENSE, (payload) => {
      const error = validateCancelData(payload);
      if (error) {
        return error;
      }
      return financialService.cancelExpense(payload.id, payload.userId, payload.reason.trim());
    }),
  );
}

module.exports = registerFinancialHandlers;

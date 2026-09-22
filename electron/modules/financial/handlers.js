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
  validateCashAccount,
  validateId,
} = require("../shared/validate");
const financialService = require("./service");

// The two collected categories are valid in the schema but not here, because only recordPayment writes
// them: one for the monthly dues and one for the investment fund. A severance_fund expense is a transfer
// from the main cash into the severance fund, entered by hand.
// Both lists match the schema CHECKs and the selects on the matching pages.
const COLLECTED_INCOME_CATEGORIES = ["dues", "investment_dues"];

// Neither of these belongs to the investment fund: a severance transfer and a staff advance are each
// booked against a ledger of their own. Same rule as the CHECK on expenses.
const FUND_LOCKED_CATEGORIES = ["severance_fund", "staff_advance"];
const MANUAL_INCOME_CATEGORIES = [
  "rent",
  "parking",
  "utility_share",
  "special_fee",
  "penalty",
  "interest",
  "advance_repayment",
  "other",
];
const EXPENSE_CATEGORIES = [
  "electricity",
  "water",
  "utility",
  "heating",
  "elevator",
  "garden",
  "maintenance",
  "equipment",
  "cleaning",
  "staff",
  "staff_insurance",
  "staff_advance",
  "severance_fund",
  "bank_fee",
  "building_insurance",
  "legal",
  "office",
  "management",
  "other",
];

const DOCUMENT_TYPES = ["income", "expense"];

// The two categories that name an employee. The schema CHECKs tie employee_id to them.
const EMPLOYEE_CATEGORIES = ["staff_advance", "advance_repayment"];

// Trims and turns an empty description into null. The category gets no default, an empty one is rejected.
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
  if (payload.description != null) {
    if (typeof payload.description !== "string") {
      return fail("Geçersiz açıklama.");
    }
    if (payload.description.length > 500) {
      return fail("Açıklama en fazla 500 karakter olabilir.");
    }
  }
  if (payload.category == null || payload.category === "") {
    return fail("Kategori seçilmelidir.");
  }
  if (!allowedCategories.includes(payload.category)) {
    return fail("Geçersiz kategori.");
  }
  return null;
}

// An advance or a repayment has to name the employee, every other record must not.
function validateEmployeeLink(payload) {
  if (payload.employee_id === undefined) {
    payload.employee_id = null;
  }
  if (!EMPLOYEE_CATEGORIES.includes(payload.category)) {
    return payload.employee_id === null ? null : fail("Bu kategoride çalışan seçilemez.");
  }
  if (payload.employee_id === null) {
    return fail("Çalışan seçilmelidir.");
  }
  return validateId(payload.employee_id, "çalışan ID");
}

function validatePaymentMethod(value) {
  return PAYMENT_METHODS.includes(value) ? null : fail("Geçersiz ödeme şekli.");
}

// A manual income has to say how it was paid, because its receipt has no payment row to read it from.
function validateIncomeFields(payload) {
  normalizeFinancialData(payload);
  if (COLLECTED_INCOME_CATEGORIES.includes(payload.category)) {
    return fail("Aidat gelirleri elle eklenemez; daire üzerinden tahsil edilir.");
  }
  return (
    validateRecordFields(payload, MANUAL_INCOME_CATEGORIES) ??
    validateEmployeeLink(payload) ??
    validatePaymentMethod(payload.payment_method)
  );
}

// Whether the investment fund paid for the expense. The flag is optional because leaving it out means the
// main cash paid, which is the ordinary case, and the service turns it into the 0 or 1 the column holds.
function validateInvestmentFlag(payload) {
  if (payload.is_investment == null) {
    payload.is_investment = 0;
    return null;
  }
  if (typeof payload.is_investment !== "boolean") {
    return fail("Geçersiz yatırım fonu bilgisi.");
  }
  payload.is_investment = payload.is_investment ? 1 : 0;
  if (payload.is_investment === 1 && FUND_LOCKED_CATEGORIES.includes(payload.category)) {
    return fail("Bu kalem yatırım fonundan ödenemez.");
  }
  return null;
}

// An expense says which account paid it. An income needs no account, its payment method decides.
function validateExpenseFields(payload) {
  normalizeFinancialData(payload);
  return (
    validateRecordFields(payload, EXPENSE_CATEGORIES) ??
    validateEmployeeLink(payload) ??
    validateCashAccount(payload.account) ??
    validateInvestmentFlag(payload)
  );
}

// A transfer between cash and bank. The limits match the CHECKs of cash_transfers.
function validateTransferFields(payload) {
  normalizeOptionalText(payload, "description");
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return fail("Geçersiz tutar.");
  }
  if (payload.amount > 1000000) {
    return fail("Tutar 1.000.000₺'yi aşamaz.");
  }
  if (!isValidDate(payload.date)) {
    return fail("Geçersiz tarih.");
  }
  if (payload.date > trToday()) {
    return fail("İleri bir tarih seçilemez.");
  }
  return (
    validateCashAccount(payload.to_account) ??
    validateOptionalText(payload.description, 300, "Açıklama en fazla 300 karakter olabilir.")
  );
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
  handle(
    CH.FINANCIAL.ADD_TRANSFER,
    (payload) =>
      validateBuildingScope(payload) ?? validateId(payload.userId, "kullanıcı ID") ?? validateTransferFields(payload),
    financialService.addTransfer,
  );
  handle(
    CH.FINANCIAL.CANCEL_TRANSFER,
    (payload) => validateCancelScope(payload) ?? validateCancelReason(payload),
    financialService.cancelTransfer,
  );
  handle(CH.FINANCIAL.GET_DOCUMENT, validateDocumentScope, financialService.getDocument);
  handle(
    CH.FINANCIAL.SAVE_DOCUMENT_INFO,
    (payload) => validateDocumentScope(payload) ?? validateDocumentFields(payload),
    financialService.saveDocumentInfo,
  );
}

module.exports = registerFinancialHandlers;

// Validation parts used by more than one domain. It gives you checks for the shared limits and
// only the messages that read the same everywhere. Field wording stays in the domain.
const { currentPeriod, toPeriod } = require("./trTime");

// Same list as the schema CHECK and APARTMENT_TYPES in src/utils/constants.js.
const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];

// Used by dues and cashbook. Same list as the due_payments and incomes CHECKs and
// PAYMENT_METHOD_LABELS in src/utils/constants.js.
const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

// The two accounts of the main cash, used by cashbook and staff. Same list as the account CHECKs and
// CASH_ACCOUNT_LABELS in src/utils/constants.js.
const CASH_ACCOUNTS = ["cash", "bank"];

// Path separators and the characters Windows does not allow in a file name.
const FILE_NAME_RE = /[\\/:*?"<>|]/;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The limits stay inside the checks below and are not exported.
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_DATE = "2000-01-01";
const MAX_DATE = "2100-12-31";
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;
const MAX_FILE_NAME_LENGTH = 150;

// Every validator returns an error object like this, or null.
function fail(message) {
  return { success: false, message };
}

function noValidation() {
  return null;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail("Geçersiz istek.");
  }
  return null;
}

function validateId(value, label) {
  return Number.isInteger(value) && value > 0 ? null : fail(`Geçersiz ${label}.`);
}

function validateBuildingScope(payload) {
  return validatePayload(payload) ?? validateId(payload.buildingId, "bina ID");
}

// Shared by apartment and building, since a building can be created together with its apartments.
function validateApartmentType(value) {
  return APARTMENT_TYPES.includes(value) ? null : fail("Geçersiz daire tipi.");
}

function validateDueAmount(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 50000) {
    return fail("Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
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

// Used by cashbook and staff, both with the same sentence.
function validateCashAccount(value) {
  return CASH_ACCOUNTS.includes(value) ? null : fail("Geçersiz hesap.");
}

// Used by severance and investment. Both funds can hold money set aside before they were started,
// and both say so with the same sentence. The limits match the two opening_balance CHECKs.
function validateOpeningBalance(value) {
  if (!Number.isFinite(value) || value < 0) {
    return fail("Geçersiz açılış bakiyesi.");
  }
  if (value > 100000000) {
    return fail("Açılış bakiyesi 100.000.000₺'yi aşamaz.");
  }
  return null;
}

// Used by apartment and investment: a new amount either reaches the month in progress or waits for the next one.
function validateCurrentMonthScope(payload) {
  if (typeof payload.applyCurrentMonth !== "boolean") {
    return fail("Geçerlilik dönemi bilgisi eksik.");
  }
  return null;
}

// Used by dues and report. The future-period message differs per domain, so it is a parameter.
function validatePeriod(payload, futureMessage) {
  if (!isValidYear(payload.year) || !isValidMonth(payload.month)) {
    return fail("Geçersiz tarih bilgisi.");
  }
  if (toPeriod(payload.year, payload.month) > currentPeriod()) {
    return fail(futureMessage);
  }
  return null;
}

// Format, range and real-calendar check in one, because no caller reports them separately.
function isValidDate(value) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  if (value < MIN_DATE || value > MAX_DATE) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidYear(value) {
  return Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR;
}

function isValidMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidFileName(value) {
  if (typeof value !== "string" || !value || value.length > MAX_FILE_NAME_LENGTH) return false;
  return !FILE_NAME_RE.test(value);
}

function isValidEmail(value) {
  if (typeof value !== "string" || value.length < MIN_EMAIL_LENGTH || value.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_RE.test(value);
}

module.exports = {
  APARTMENT_TYPES,
  CASH_ACCOUNTS,
  PAYMENT_METHODS,
  fail,
  isValidDate,
  isValidEmail,
  isValidFileName,
  isValidMonth,
  isValidYear,
  noValidation,
  validateApartmentType,
  validateBuildingScope,
  validateCancelReason,
  validateCashAccount,
  validateCurrentMonthScope,
  validateDueAmount,
  validateId,
  validateOpeningBalance,
  validatePayload,
  validatePeriod,
};

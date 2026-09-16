// Validation parts used by more than one domain. It gives you checks for the shared limits and
// only the messages that read the same everywhere. Field wording stays in the domain.
const { currentPeriod, toPeriod } = require("./trTime");

// Same list as the schema CHECK and APARTMENT_TYPES in src/utils/constants.js.
const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];

// Used by dues and financial. Same list as the due_payments and incomes CHECKs and
// PAYMENT_METHOD_LABELS in src/utils/constants.js.
const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

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

// First link of every chain. It makes sure the payload is a plain object for the checks that follow.
function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail("Geçersiz istek.");
  }
  return null;
}

function validateId(value, label) {
  return Number.isInteger(value) && value > 0 ? null : fail(`Geçersiz ${label}.`);
}

// Used by six domains. Each one chains its own id check after this.
function validateBuildingScope(payload) {
  return validatePayload(payload) ?? validateId(payload.buildingId, "bina ID");
}

// Used by apartment and building with the same sentence, because a building can be created
// together with its apartments.
function validateApartmentType(value) {
  return APARTMENT_TYPES.includes(value) ? null : fail("Geçersiz daire tipi.");
}

function validateDueAmount(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 50000) {
    return fail("Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
  }
  return null;
}

// Used by dues and financial with the same sentence, so it lives here.
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

// Used by report for the saved PDF and by dues for the payment receipt.
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
  validateDueAmount,
  validateId,
  validatePayload,
  validatePeriod,
};

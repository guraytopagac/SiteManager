// Validation parts used by more than one domain. It gives you checks for the shared limits and
// only the messages that read the same everywhere. Field wording stays in the domain.
const { currentPeriod, toPeriod } = require("./trTime");

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The limits stay inside the checks below and are not exported.
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_DATE = "2000-01-01";
const MAX_DATE = "2100-12-31";
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;

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

function isValidEmail(value) {
  if (typeof value !== "string" || value.length < MIN_EMAIL_LENGTH || value.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_RE.test(value);
}

module.exports = {
  fail,
  isValidDate,
  isValidEmail,
  isValidMonth,
  isValidYear,
  noValidation,
  validateBuildingScope,
  validateCancelReason,
  validateId,
  validatePayload,
  validatePeriod,
};

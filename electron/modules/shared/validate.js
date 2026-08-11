const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_DATE = "2000-01-01";
const MAX_DATE = "2100-12-31";
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;

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

function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isDateInRange(value) {
  return value >= MIN_DATE && value <= MAX_DATE;
}

function isValidYear(value) {
  return Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR;
}

function isValidMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isEmailFormat(value) {
  return typeof value === "string" && EMAIL_RE.test(value);
}

module.exports = {
  MAX_EMAIL_LENGTH,
  MIN_EMAIL_LENGTH,
  fail,
  isDateInRange,
  isEmailFormat,
  isIsoDate,
  isValidMonth,
  isValidYear,
  noValidation,
  validateBuildingScope,
  validateId,
  validatePayload,
};

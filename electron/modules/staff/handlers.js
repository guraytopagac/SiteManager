const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { formatPersonName } = require("../shared/personName");
const { trToday } = require("../shared/trTime");
const {
  fail,
  isValidDate,
  validateBuildingScope,
  validateCancelReason,
  validateCashAccount,
  validateId,
  validateOpeningBalance,
} = require("../shared/validate");
const staffService = require("./service");

// Trims an optional text field and turns an empty or missing value into null.
function normalizeOptionalText(payload, field) {
  if (typeof payload[field] === "string") {
    payload[field] = payload[field].trim();
  }
  if (payload[field] == null || payload[field] === "") {
    payload[field] = null;
  }
}

// Today or an earlier day. The limits match the CHECK constraints.
function validateNotFutureDate(value, message) {
  if (!isValidDate(value)) return fail(message);
  if (value > trToday()) return fail("İleri bir tarih seçilemez.");
  return null;
}

function validateEmployeeScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.employeeId, "çalışan ID");
}

// The limits match the employees CHECKs.
function validateEmployeeFields(payload) {
  if (typeof payload.full_name !== "string") {
    return fail("Ad soyad zorunludur.");
  }
  payload.full_name = formatPersonName(payload.full_name);
  if (typeof payload.role !== "string" || payload.role.trim() === "") {
    return fail("Görev zorunludur.");
  }
  payload.role = payload.role.trim();

  if (payload.full_name.length < 2 || payload.full_name.length > 60) {
    return fail("Ad soyad 2 ile 60 karakter arasında olmalıdır.");
  }
  if (payload.role.length > 40) {
    return fail("Görev en fazla 40 karakter olabilir.");
  }
  if (!Number.isFinite(payload.gross_wage) || payload.gross_wage <= 0) {
    return fail("Geçersiz brüt ücret.");
  }
  if (payload.gross_wage > 1000000) {
    return fail("Brüt ücret 1.000.000₺'yi aşamaz.");
  }
  return validateNotFutureDate(payload.start_date, "Geçersiz işe giriş tarihi.");
}

// The leaving date is optional on an edit, since an employee can leave without a payout.
function validateEmployeeEndDate(payload) {
  if (payload.end_date === undefined || payload.end_date === "") {
    payload.end_date = null;
  }
  if (payload.end_date === null) return null;
  return validateNotFutureDate(payload.end_date, "Geçersiz ayrılış tarihi.");
}

function validatePayoutFields(payload) {
  normalizeOptionalText(payload, "note");
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return fail("Geçersiz tutar.");
  }
  if (payload.amount > 5000000) {
    return fail("Tazminat tutarı 5.000.000₺'yi aşamaz.");
  }
  if (payload.note !== null && (typeof payload.note !== "string" || payload.note.length > 300)) {
    return fail("Not en fazla 300 karakter olabilir.");
  }
  // The account pays a top-up only when the fund is short, but the service decides that, so it is always sent.
  return (
    validateNotFutureDate(payload.date, "Geçersiz ödeme tarihi.") ??
    validateNotFutureDate(payload.end_date, "Geçersiz ayrılış tarihi.") ??
    validateCashAccount(payload.top_up_account)
  );
}

// Two ids again: buildingId says which building, userId says who did it.
function validatePayoutScope(payload) {
  return validateEmployeeScope(payload) ?? validateId(payload.userId, "kullanıcı ID");
}

function validatePayoutCancelScope(payload) {
  return (
    validateBuildingScope(payload) ??
    validateId(payload.payoutId, "ödeme ID") ??
    validateId(payload.userId, "kullanıcı ID")
  );
}

function registerStaffHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "staff");

  handle(CH.STAFF.GET_OVERVIEW, validateBuildingScope, staffService.getOverview);
  handle(CH.STAFF.GET_EMPLOYEES, validateBuildingScope, staffService.getEmployees);
  handle(
    CH.STAFF.SETUP_FUND,
    (payload) => validateBuildingScope(payload) ?? validateOpeningBalance(payload.openingBalance),
    staffService.setupFund,
  );
  handle(
    CH.STAFF.UPDATE_FUND,
    (payload) => validateBuildingScope(payload) ?? validateOpeningBalance(payload.openingBalance),
    staffService.updateFund,
  );
  handle(
    CH.STAFF.ADD_EMPLOYEE,
    (payload) => validateBuildingScope(payload) ?? validateEmployeeFields(payload),
    staffService.addEmployee,
  );
  handle(
    CH.STAFF.UPDATE_EMPLOYEE,
    (payload) => validateEmployeeScope(payload) ?? validateEmployeeFields(payload) ?? validateEmployeeEndDate(payload),
    staffService.updateEmployee,
  );
  handle(CH.STAFF.DELETE_EMPLOYEE, validateEmployeeScope, staffService.deleteEmployee);
  handle(
    CH.STAFF.RECORD_PAYOUT,
    (payload) => validatePayoutScope(payload) ?? validatePayoutFields(payload),
    staffService.recordPayout,
  );
  handle(
    CH.STAFF.CANCEL_PAYOUT,
    (payload) => validatePayoutCancelScope(payload) ?? validateCancelReason(payload),
    staffService.cancelPayout,
  );
}

module.exports = registerStaffHandlers;

const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const {
  fail,
  validateApartmentType,
  validateBuildingScope,
  validateDueAmount,
  validateId,
} = require("../shared/validate");
const apartmentService = require("./service");

const APARTMENT_NO_RE = /^[A-Za-z0-9]{1,10}$/;

// Named differently from validateApartmentScope in resident, which checks another field.
function validateOwnedApartmentScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.id, "daire ID");
}

// Trims first, so it can be chained after a scope validator. The limits match the CHECK constraints on the
// apartments table. The due amount is checked apart, because only one of the two callers sends it.
function validateApartmentFields(payload) {
  payload.apartment_no = typeof payload.apartment_no === "string" ? payload.apartment_no.trim() : "";
  if (!APARTMENT_NO_RE.test(payload.apartment_no)) {
    return fail("Daire numarası 1-10 karakter olmalı ve yalnızca harf/rakam içermelidir.");
  }

  const { floor, square_meters: squareMeters } = payload;
  if (!Number.isInteger(floor) || floor < -2 || floor > 99) {
    return fail("Kat -2 ile 99 arasında olmalıdır.");
  }
  if (squareMeters != null && (!Number.isFinite(squareMeters) || squareMeters <= 0 || squareMeters > 1000)) {
    return fail("Metrekare 0'dan büyük olmalı ve 1000'i geçmemelidir.");
  }

  return validateApartmentType(payload.type);
}

function validateCurrentMonthScope(payload) {
  if (typeof payload.applyCurrentMonth !== "boolean") {
    return fail("Geçerlilik dönemi bilgisi eksik.");
  }
  return null;
}

// The amount belongs to the dues page, so an update that leaves it out keeps the current one. Sending one
// also means answering which period it starts from, the same question the bulk endpoint asks.
function validateDueAmountChange(payload) {
  if (payload.due_amount == null) {
    return null;
  }
  return validateDueAmount(payload.due_amount) ?? validateCurrentMonthScope(payload);
}

function registerApartmentHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "apartment");

  handle(
    CH.APARTMENT.ADD,
    (payload) =>
      validateBuildingScope(payload) ?? validateApartmentFields(payload) ?? validateDueAmount(payload.due_amount),
    apartmentService.addApartment,
  );
  handle(
    CH.APARTMENT.UPDATE,
    (payload) =>
      validateOwnedApartmentScope(payload) ?? validateApartmentFields(payload) ?? validateDueAmountChange(payload),
    apartmentService.updateApartment,
  );
  handle(CH.APARTMENT.DELETE, validateOwnedApartmentScope, apartmentService.deleteApartment);
  handle(
    CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT,
    (payload) =>
      validateBuildingScope(payload) ?? validateDueAmount(payload.amount) ?? validateCurrentMonthScope(payload),
    apartmentService.bulkUpdateDueAmount,
  );
}

module.exports = registerApartmentHandlers;

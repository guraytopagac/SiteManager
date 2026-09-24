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

// Every id must be valid and listed once, so the service can compare the count with the rows it finds.
function validateApartmentIds(payload) {
  const ids = payload.apartmentIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return fail("En az bir daire seçilmelidir.");
  }
  if (!ids.every((id) => Number.isInteger(id) && id > 0) || new Set(ids).size !== ids.length) {
    return fail("Geçersiz daire seçimi.");
  }
  return null;
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
    (payload) => validateOwnedApartmentScope(payload) ?? validateApartmentFields(payload),
    apartmentService.updateApartment,
  );
  handle(CH.APARTMENT.DELETE, validateOwnedApartmentScope, apartmentService.deleteApartment);
  handle(
    CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT,
    (payload) =>
      validateBuildingScope(payload) ?? validateDueAmount(payload.amount) ?? validateCurrentMonthScope(payload),
    apartmentService.bulkUpdateDueAmount,
  );
  handle(
    CH.APARTMENT.UPDATE_DUE_AMOUNTS,
    (payload) =>
      validateBuildingScope(payload) ??
      validateApartmentIds(payload) ??
      validateDueAmount(payload.amount) ??
      validateCurrentMonthScope(payload),
    apartmentService.updateDueAmounts,
  );
}

module.exports = registerApartmentHandlers;

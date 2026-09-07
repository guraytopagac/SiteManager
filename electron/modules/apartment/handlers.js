// Apartment IPC entry points. Validation only, the SQL is in service.js.
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

// Trims first, so it can be chained after a scope validator. The limits match the CHECK
// constraints on the apartments table one to one.
function validateApartmentFields(payload) {
  payload.apartment_no = typeof payload.apartment_no === "string" ? payload.apartment_no.trim() : "";
  if (!APARTMENT_NO_RE.test(payload.apartment_no)) {
    return fail("Daire numarası 1-10 karakter olmalı ve yalnızca harf/rakam içermelidir.");
  }

  const { floor, square_meters: squareMeters } = payload;
  if (floor != null && (!Number.isInteger(floor) || floor < -2 || floor > 99)) {
    return fail("Kat -2 ile 99 arasında olmalıdır.");
  }
  if (squareMeters != null && (!Number.isFinite(squareMeters) || squareMeters <= 0 || squareMeters > 1000)) {
    return fail("Metrekare 0'dan büyük olmalı ve 1000'i geçmemelidir.");
  }

  return validateApartmentType(payload.type) ?? validateDueAmount(payload.due_amount);
}

function validateBulkScope(payload) {
  if (typeof payload.applyCurrentMonth !== "boolean") {
    return fail("Geçerlilik dönemi bilgisi eksik.");
  }
  return null;
}

function registerApartmentHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "apartment");

  handle(
    CH.APARTMENT.ADD,
    (payload) => validateBuildingScope(payload) ?? validateApartmentFields(payload),
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
    (payload) => validateBuildingScope(payload) ?? validateDueAmount(payload.amount) ?? validateBulkScope(payload),
    apartmentService.bulkUpdateDueAmount,
  );
}

module.exports = registerApartmentHandlers;

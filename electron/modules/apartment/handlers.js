const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../shared/safeHandler");
const { fail, validateBuildingScope, validateId } = require("../shared/validate");
const apartmentService = require("./service");

const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];
const APARTMENT_NO_RE = /^[A-Za-z0-9]{1,10}$/;

function validateApartmentScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.id, "daire ID");
}

function validateDueAmount(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 50000) {
    return fail("Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
  }
  return null;
}

function validateApartmentFields(payload) {
  payload.apartment_no = typeof payload.apartment_no === "string" ? payload.apartment_no.trim() : "";
  if (!APARTMENT_NO_RE.test(payload.apartment_no)) {
    return fail("Daire numarası 1-10 karakter olmalı ve yalnızca harf/rakam içermelidir.");
  }
  if (!APARTMENT_TYPES.includes(payload.type)) {
    return fail("Geçersiz daire tipi.");
  }

  const { floor, square_meters: squareMeters } = payload;
  if (floor != null && (!Number.isInteger(floor) || floor < -2 || floor > 99)) {
    return fail("Kat -2 ile 99 arasında olmalıdır.");
  }
  if (squareMeters != null && (!Number.isFinite(squareMeters) || squareMeters <= 0 || squareMeters > 1000)) {
    return fail("Metrekare 0'dan büyük olmalı ve 1000'i geçmemelidir.");
  }

  return validateDueAmount(payload.due_amount);
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
    (payload) => validateApartmentScope(payload) ?? validateApartmentFields(payload),
    apartmentService.updateApartment,
  );
  handle(CH.APARTMENT.DELETE, validateApartmentScope, apartmentService.deleteApartment);
  handle(
    CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT,
    (payload) => validateBuildingScope(payload) ?? validateDueAmount(payload.amount),
    apartmentService.bulkUpdateDueAmount,
  );
}

module.exports = registerApartmentHandlers;

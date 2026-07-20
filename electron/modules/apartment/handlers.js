const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const apartmentService = require("./service");

const safeHandler = createSafeHandler("apartment");

const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];
const APARTMENT_NO_RE = /^[A-Za-z0-9]{1,10}$/;
const DUE_AMOUNT_MIN = 0;
const DUE_AMOUNT_MAX = 50000;
const FLOOR_MIN = -2;
const FLOOR_MAX = 99;
const SQUARE_METERS_MIN = 0;
const SQUARE_METERS_MAX = 1000;

const TRIMMED_FIELDS = ["apartment_no"];

function normalizeApartmentData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return;
  }
  for (const field of TRIMMED_FIELDS) {
    if (typeof data[field] === "string") {
      data[field] = data[field].trim();
    }
  }
}

function validateApartmentData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof data.apartment_no !== "string" || !APARTMENT_NO_RE.test(data.apartment_no)) {
    return { success: false, message: "Daire numarası 1-10 karakter olmalı ve yalnızca harf/rakam içermelidir." };
  }
  if (!Number.isInteger(data.managerId) || data.managerId <= 0) {
    return { success: false, message: "Geçersiz site yöneticisi ID." };
  }
  if (typeof data.type !== "string" || !APARTMENT_TYPES.includes(data.type)) {
    return { success: false, message: "Geçersiz daire tipi." };
  }
  if (!Number.isFinite(data.due_amount) || data.due_amount <= DUE_AMOUNT_MIN || data.due_amount > DUE_AMOUNT_MAX) {
    return { success: false, message: "Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir." };
  }
  if (data.floor !== null && data.floor !== undefined) {
    if (!Number.isInteger(data.floor) || data.floor < FLOOR_MIN || data.floor > FLOOR_MAX) {
      return { success: false, message: "Kat -2 ile 99 arasında olmalıdır." };
    }
  }
  if (data.square_meters !== null && data.square_meters !== undefined) {
    if (
      !Number.isFinite(data.square_meters) ||
      data.square_meters <= SQUARE_METERS_MIN ||
      data.square_meters > SQUARE_METERS_MAX
    ) {
      return { success: false, message: "Metrekare 0'dan büyük olmalı ve 1000'i geçmemelidir." };
    }
  }
  return null;
}

function validateUpdatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (!Number.isInteger(payload.id) || payload.id <= 0) {
    return { success: false, message: "Geçersiz daire ID." };
  }
  normalizeApartmentData(payload.data);
  return validateApartmentData(payload.data);
}

function validateDeletePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { id, managerId } = payload;
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Geçersiz daire ID." };
  }
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  return null;
}

function validateBulkUpdateDueAmountPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { managerId, amount } = payload;
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  if (!Number.isFinite(amount) || amount <= DUE_AMOUNT_MIN || amount > DUE_AMOUNT_MAX) {
    return { success: false, message: "Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir." };
  }
  return null;
}

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle(
    CH.APARTMENT.ADD,
    safeHandler(CH.APARTMENT.ADD, (data) => {
      normalizeApartmentData(data);
      const error = validateApartmentData(data);
      if (error) {
        return error;
      }
      return apartmentService.addApartment(data);
    }),
  );

  ipcMain.handle(
    CH.APARTMENT.UPDATE,
    safeHandler(CH.APARTMENT.UPDATE, (payload) => {
      const error = validateUpdatePayload(payload);
      if (error) {
        return error;
      }
      return apartmentService.updateApartment(payload.id, payload.data);
    }),
  );

  ipcMain.handle(
    CH.APARTMENT.DELETE,
    safeHandler(CH.APARTMENT.DELETE, (payload) => {
      const error = validateDeletePayload(payload);
      if (error) {
        return error;
      }
      return apartmentService.deleteApartment(payload.id, payload.managerId);
    }),
  );

  ipcMain.handle(
    CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT,
    safeHandler(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, (payload) => {
      const error = validateBulkUpdateDueAmountPayload(payload);
      if (error) {
        return error;
      }
      return apartmentService.bulkUpdateDueAmount(payload.managerId, payload.amount);
    }),
  );
}

module.exports = registerApartmentHandlers;

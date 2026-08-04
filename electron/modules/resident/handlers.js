const { CHANNELS: CH } = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const residentService = require("./service");

const safeHandler = createSafeHandler("resident");

const RESIDENT_TYPES = ["owner", "tenant"];
const PHONE_RE = /^[0-9+()\- ]+$/;
const EMAIL_RE = /^.+@.+\..+$/;
const NON_ASCII_RE = /[^\x20-\x7E]/;
const NATIONAL_ID_RE = /^[0-9]{11}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FULL_NAME_LENGTH = 60;
const MIN_PHONE_LENGTH = 10;
const MAX_PHONE_LENGTH = 20;
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;
const MAX_NOTES_LENGTH = 500;

const TRIMMED_FIELDS = [
  "full_name",
  "phone",
  "email",
  "national_id",
  "resident_type",
  "move_in_date",
  "move_out_date",
  "notes",
];

function normalizeResidentData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  for (const field of TRIMMED_FIELDS) {
    if (typeof data[field] === "string") {
      data[field] = data[field].trim();
    }
  }
}

function isValidIsoDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function validateResidentDates(data) {
  const moveIn = data.move_in_date;
  const moveOut = data.move_out_date;
  if (moveIn !== null && moveIn !== undefined && moveIn !== "") {
    if (typeof moveIn !== "string" || !isValidIsoDate(moveIn)) {
      return { success: false, message: "Geçersiz giriş tarihi." };
    }
  }
  if (moveOut !== null && moveOut !== undefined && moveOut !== "") {
    if (typeof moveOut !== "string" || !isValidIsoDate(moveOut)) {
      return { success: false, message: "Geçersiz çıkış tarihi." };
    }
    if (typeof moveIn === "string" && moveIn !== "" && moveOut < moveIn) {
      return { success: false, message: "Çıkış tarihi giriş tarihinden önce olamaz." };
    }
  }
  return null;
}

function validateResidentFields(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (data.resident_type !== null && data.resident_type !== undefined && data.resident_type !== "") {
    if (typeof data.resident_type !== "string" || !RESIDENT_TYPES.includes(data.resident_type)) {
      return { success: false, message: "Geçersiz sakin türü." };
    }
  }
  if (data.full_name !== null && data.full_name !== undefined) {
    if (typeof data.full_name !== "string") {
      return { success: false, message: "Geçersiz ad soyad." };
    }
    if (data.full_name.length > MAX_FULL_NAME_LENGTH) {
      return { success: false, message: "Ad soyad en fazla 60 karakter olabilir." };
    }
  }
  if (data.phone !== null && data.phone !== undefined) {
    if (typeof data.phone !== "string") {
      return { success: false, message: "Geçersiz telefon numarası." };
    }
    if (
      data.phone !== "" &&
      (data.phone.length < MIN_PHONE_LENGTH || data.phone.length > MAX_PHONE_LENGTH || !PHONE_RE.test(data.phone))
    ) {
      return {
        success: false,
        message: "Telefon numarası 10 ile 20 karakter arasında olmalı ve yalnızca rakam ve +()- içerebilir.",
      };
    }
  }
  if (data.email !== null && data.email !== undefined) {
    if (typeof data.email !== "string") {
      return { success: false, message: "Geçersiz e-posta adresi." };
    }
    if (data.email !== "") {
      if (NON_ASCII_RE.test(data.email)) {
        return { success: false, message: "E-posta adresinde Türkçe veya özel karakter kullanılamaz." };
      }
      if (data.email.length < MIN_EMAIL_LENGTH || data.email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(data.email)) {
        return { success: false, message: "Geçerli bir e-posta adresi girin (örn. ornek@site.com)." };
      }
    }
  }
  if (data.national_id !== null && data.national_id !== undefined) {
    if (typeof data.national_id !== "string") {
      return { success: false, message: "Geçersiz TC Kimlik No." };
    }
    if (data.national_id !== "" && !NATIONAL_ID_RE.test(data.national_id)) {
      return { success: false, message: "TC Kimlik No 11 haneli rakamdan oluşmalıdır." };
    }
  }
  if (data.notes !== null && data.notes !== undefined) {
    if (typeof data.notes !== "string") {
      return { success: false, message: "Geçersiz not." };
    }
    if (data.notes.length > MAX_NOTES_LENGTH) {
      return { success: false, message: "Not en fazla 500 karakter olabilir." };
    }
  }

  return validateResidentDates(data);
}

function validateBuildingId(buildingId) {
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  return null;
}

function validateId(id, label) {
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: `Geçersiz ${label}.` };
  }
  return null;
}

function validateGetOverviewData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  return validateBuildingId(payload.buildingId);
}

function validateGetHistoryData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const idError = validateId(payload.apartmentId, "daire ID");
  if (idError) return idError;
  return validateBuildingId(payload.buildingId);
}

function validateAddResidentData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const idError = validateId(payload.apartmentId, "daire ID");
  if (idError) return idError;
  const bldError = validateBuildingId(payload.buildingId);
  if (bldError) return bldError;
  normalizeResidentData(payload);
  return validateResidentFields(payload);
}

function validateUpdateResidentData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const idError = validateId(payload.residentId, "sakin ID");
  if (idError) return idError;
  const bldError = validateBuildingId(payload.buildingId);
  if (bldError) return bldError;
  normalizeResidentData(payload);
  return validateResidentFields(payload);
}

function validateMoveOutData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const idError = validateId(payload.residentId, "sakin ID");
  if (idError) return idError;
  const bldError = validateBuildingId(payload.buildingId);
  if (bldError) return bldError;
  if (typeof payload.moveOutDate === "string") payload.moveOutDate = payload.moveOutDate.trim();
  if (typeof payload.moveOutDate !== "string" || !isValidIsoDate(payload.moveOutDate)) {
    return { success: false, message: "Geçersiz çıkış tarihi." };
  }
  return null;
}

function registerResidentHandlers(ipcMain) {
  ipcMain.handle(
    CH.RESIDENT.GET_OVERVIEW,
    safeHandler(CH.RESIDENT.GET_OVERVIEW, (payload) => {
      const error = validateGetOverviewData(payload);
      if (error) {
        return error;
      }
      return residentService.getResidentsOverview(payload.buildingId);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.GET_HISTORY,
    safeHandler(CH.RESIDENT.GET_HISTORY, (payload) => {
      const error = validateGetHistoryData(payload);
      if (error) {
        return error;
      }
      return residentService.getResidentHistory(payload.apartmentId, payload.buildingId);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.ADD,
    safeHandler(CH.RESIDENT.ADD, (payload) => {
      const error = validateAddResidentData(payload);
      if (error) {
        return error;
      }
      return residentService.addResident(payload);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.UPDATE,
    safeHandler(CH.RESIDENT.UPDATE, (payload) => {
      const error = validateUpdateResidentData(payload);
      if (error) {
        return error;
      }
      return residentService.updateResident(payload);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.MOVE_OUT,
    safeHandler(CH.RESIDENT.MOVE_OUT, (payload) => {
      const error = validateMoveOutData(payload);
      if (error) {
        return error;
      }
      return residentService.moveOutResident(payload);
    }),
  );
}

module.exports = registerResidentHandlers;

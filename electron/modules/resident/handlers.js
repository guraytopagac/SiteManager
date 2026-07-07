const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../../ipc/safeHandler");
const residentService = require("./service");

const safeHandler = createSafeHandler("resident");

const RESIDENT_TYPES = ["owner", "tenant"];
const PHONE_RE = /^[0-9+()\- ]+$/;
const EMAIL_RE = /^.+@.+\..+$/;
const NON_ASCII_RE = /[^\x20-\x7E]/;
const NATIONAL_ID_RE = /^[0-9]{11}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

// Validate the resident field set. Every field is optional; empty string is allowed.
function validateResidentFields(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (data.resident_type !== null && data.resident_type !== undefined && data.resident_type !== "") {
    if (typeof data.resident_type !== "string" || !RESIDENT_TYPES.includes(data.resident_type)) {
      return { success: false, message: "Geçersiz sakin türü." };
    }
  }
  if (data.phone !== null && data.phone !== undefined) {
    if (typeof data.phone !== "string") {
      return { success: false, message: "Geçersiz telefon numarası." };
    }
    if (data.phone !== "" && (data.phone.length < 10 || !PHONE_RE.test(data.phone))) {
      return {
        success: false,
        message: "Telefon numarası en az 10 karakter olmalı ve yalnızca rakam ve +()- içerebilir.",
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
      if (data.email.length < 5 || !EMAIL_RE.test(data.email)) {
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

  return validateResidentDates(data);
}

function validateManagerId(managerId) {
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return { success: false, message: "Geçersiz yönetici ID." };
  }
  return null;
}

function validateId(id, label) {
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: `Geçersiz ${label}.` };
  }
  return null;
}

function registerResidentHandlers(ipcMain) {
  ipcMain.handle(
    CH.RESIDENT.GET_OVERVIEW,
    safeHandler(CH.RESIDENT.GET_OVERVIEW, (managerId) => {
      const error = validateManagerId(managerId);
      if (error) return error;
      return residentService.getResidentsOverview(managerId);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.GET_HISTORY,
    safeHandler(CH.RESIDENT.GET_HISTORY, (payload) => {
      if (!payload || typeof payload !== "object") return { success: false, message: "Geçersiz istek." };
      const idError = validateId(payload.apartmentId, "daire ID");
      if (idError) return idError;
      const mgrError = validateManagerId(payload.managerId);
      if (mgrError) return mgrError;
      return residentService.getResidentHistory(payload.apartmentId, payload.managerId);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.ADD,
    safeHandler(CH.RESIDENT.ADD, (payload) => {
      if (!payload || typeof payload !== "object") return { success: false, message: "Geçersiz istek." };
      const idError = validateId(payload.apartmentId, "daire ID");
      if (idError) return idError;
      const mgrError = validateManagerId(payload.managerId);
      if (mgrError) return mgrError;
      normalizeResidentData(payload);
      const error = validateResidentFields(payload);
      if (error) return error;
      return residentService.addResident(payload);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.UPDATE,
    safeHandler(CH.RESIDENT.UPDATE, (payload) => {
      if (!payload || typeof payload !== "object") return { success: false, message: "Geçersiz istek." };
      const idError = validateId(payload.residentId, "sakin ID");
      if (idError) return idError;
      const mgrError = validateManagerId(payload.managerId);
      if (mgrError) return mgrError;
      normalizeResidentData(payload);
      const error = validateResidentFields(payload);
      if (error) return error;
      return residentService.updateResident(payload);
    }),
  );

  ipcMain.handle(
    CH.RESIDENT.MOVE_OUT,
    safeHandler(CH.RESIDENT.MOVE_OUT, (payload) => {
      if (!payload || typeof payload !== "object") return { success: false, message: "Geçersiz istek." };
      const idError = validateId(payload.residentId, "sakin ID");
      if (idError) return idError;
      const mgrError = validateManagerId(payload.managerId);
      if (mgrError) return mgrError;
      if (typeof payload.moveOutDate === "string") payload.moveOutDate = payload.moveOutDate.trim();
      if (typeof payload.moveOutDate !== "string" || !isValidIsoDate(payload.moveOutDate)) {
        return { success: false, message: "Geçersiz çıkış tarihi." };
      }
      return residentService.moveOutResident(payload);
    }),
  );
}

module.exports = registerResidentHandlers;

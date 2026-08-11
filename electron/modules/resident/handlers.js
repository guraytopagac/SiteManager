const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../shared/safeHandler");
const {
  MAX_EMAIL_LENGTH,
  MIN_EMAIL_LENGTH,
  fail,
  isEmailFormat,
  isIsoDate,
  validateBuildingScope,
  validateId,
} = require("../shared/validate");
const residentService = require("./service");

const RESIDENT_TYPES = ["owner", "tenant"];
const PHONE_RE = /^[0-9+()\- ]+$/;
const NON_ASCII_RE = /[^\x20-\x7E]/;
const NATIONAL_ID_RE = /^[0-9]{11}$/;

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

function normalizeResidentData(payload) {
  for (const field of TRIMMED_FIELDS) {
    if (typeof payload[field] === "string") {
      payload[field] = payload[field].trim();
    }
  }
}

function validateResidentDates(payload) {
  const moveIn = payload.move_in_date;
  const moveOut = payload.move_out_date;
  if (moveIn !== null && moveIn !== undefined && moveIn !== "") {
    if (!isIsoDate(moveIn)) {
      return fail("Geçersiz giriş tarihi.");
    }
  }
  if (moveOut !== null && moveOut !== undefined && moveOut !== "") {
    if (!isIsoDate(moveOut)) {
      return fail("Geçersiz çıkış tarihi.");
    }
    if (typeof moveIn === "string" && moveIn !== "" && moveOut < moveIn) {
      return fail("Çıkış tarihi giriş tarihinden önce olamaz.");
    }
  }
  return null;
}

function validateResidentFields(payload) {
  normalizeResidentData(payload);

  const { full_name: fullName, phone, email, national_id: nationalId, resident_type: residentType, notes } = payload;

  if (residentType !== null && residentType !== undefined && residentType !== "") {
    if (!RESIDENT_TYPES.includes(residentType)) {
      return fail("Geçersiz sakin türü.");
    }
  }
  if (fullName !== null && fullName !== undefined) {
    if (typeof fullName !== "string") {
      return fail("Geçersiz ad soyad.");
    }
    if (fullName.length > 60) {
      return fail("Ad soyad en fazla 60 karakter olabilir.");
    }
  }
  if (phone !== null && phone !== undefined) {
    if (typeof phone !== "string") {
      return fail("Geçersiz telefon numarası.");
    }
    if (phone !== "" && (phone.length < 10 || phone.length > 20 || !PHONE_RE.test(phone))) {
      return fail("Telefon numarası 10 ile 20 karakter arasında olmalı ve yalnızca rakam ve +()- içerebilir.");
    }
  }
  if (email !== null && email !== undefined) {
    if (typeof email !== "string") {
      return fail("Geçersiz e-posta adresi.");
    }
    if (email !== "") {
      if (NON_ASCII_RE.test(email)) {
        return fail("E-posta adresinde Türkçe veya özel karakter kullanılamaz.");
      }
      if (email.length < MIN_EMAIL_LENGTH || email.length > MAX_EMAIL_LENGTH || !isEmailFormat(email)) {
        return fail("Geçerli bir e-posta adresi girin (örn. ornek@site.com).");
      }
    }
  }
  if (nationalId !== null && nationalId !== undefined) {
    if (typeof nationalId !== "string") {
      return fail("Geçersiz TC Kimlik No.");
    }
    if (nationalId !== "" && !NATIONAL_ID_RE.test(nationalId)) {
      return fail("TC Kimlik No 11 haneli rakamdan oluşmalıdır.");
    }
  }
  if (notes !== null && notes !== undefined) {
    if (typeof notes !== "string") {
      return fail("Geçersiz not.");
    }
    if (notes.length > 500) {
      return fail("Not en fazla 500 karakter olabilir.");
    }
  }

  return validateResidentDates(payload);
}

function validateApartmentScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.apartmentId, "daire ID");
}

function validateResidentScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.residentId, "sakin ID");
}

function validateMoveOutDate(payload) {
  if (typeof payload.moveOutDate === "string") {
    payload.moveOutDate = payload.moveOutDate.trim();
  }
  if (!isIsoDate(payload.moveOutDate)) {
    return fail("Geçersiz çıkış tarihi.");
  }
  return null;
}

function registerResidentHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "resident");

  handle(CH.RESIDENT.GET_OVERVIEW, validateBuildingScope, residentService.getResidentsOverview);
  handle(CH.RESIDENT.GET_HISTORY, validateApartmentScope, residentService.getResidentHistory);
  handle(
    CH.RESIDENT.ADD,
    (payload) => validateApartmentScope(payload) ?? validateResidentFields(payload),
    residentService.addResident,
  );
  handle(
    CH.RESIDENT.UPDATE,
    (payload) => validateResidentScope(payload) ?? validateResidentFields(payload),
    residentService.updateResident,
  );
  handle(
    CH.RESIDENT.MOVE_OUT,
    (payload) => validateResidentScope(payload) ?? validateMoveOutDate(payload),
    residentService.moveOutResident,
  );
}

module.exports = registerResidentHandlers;

// Resident IPC entry points. Every field except the apartment link is optional, so the checks
// come from a table instead of one if block per field.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/handler");
const { fail, isValidDate, isValidEmail, validateBuildingScope, validateId } = require("../shared/validate");
const residentService = require("./service");

// Rules that only residents have. Shared limits such as date and email come from shared/validate.js.
// RESIDENT_TYPES matches the schema CHECK and the select in src/pages/Residents/Residents.jsx.
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

// Checked in order, and the first failure wins. Email appears twice, because the character check
// and the format check need different messages.
const OPTIONAL_TEXT_RULES = [
  {
    field: "resident_type",
    invalid: "Geçersiz sakin türü.",
    test: (value) => RESIDENT_TYPES.includes(value),
    testMessage: "Geçersiz sakin türü.",
  },
  { field: "full_name", invalid: "Geçersiz ad soyad.", max: 60, tooLong: "Ad soyad en fazla 60 karakter olabilir." },
  {
    field: "phone",
    invalid: "Geçersiz telefon numarası.",
    test: (value) => value.length >= 10 && value.length <= 20 && PHONE_RE.test(value),
    testMessage: "Telefon numarası 10 ile 20 karakter arasında olmalı ve yalnızca rakam ve +()- içerebilir.",
  },
  {
    field: "email",
    invalid: "Geçersiz e-posta adresi.",
    test: (value) => !NON_ASCII_RE.test(value),
    testMessage: "E-posta adresinde Türkçe veya özel karakter kullanılamaz.",
  },
  {
    field: "email",
    invalid: "Geçersiz e-posta adresi.",
    test: isValidEmail,
    testMessage: "Geçerli bir e-posta adresi girin (örn. ornek@site.com).",
  },
  {
    field: "national_id",
    invalid: "Geçersiz TC Kimlik No.",
    test: (value) => NATIONAL_ID_RE.test(value),
    testMessage: "TC Kimlik No 11 haneli rakamdan oluşmalıdır.",
  },
  { field: "notes", invalid: "Geçersiz not.", max: 500, tooLong: "Not en fazla 500 karakter olabilir." },
];

// Trims, and turns an empty or missing value into null. The service then needs no fallback, and
// each check needs only one null test.
function normalizeResidentData(payload) {
  for (const field of TRIMMED_FIELDS) {
    const value = payload[field];
    if (typeof value === "string") {
      payload[field] = value.trim() || null;
    } else if (value === undefined) {
      payload[field] = null;
    }
  }
}

// A null value always passes.
function validateOptionalText(value, rule) {
  if (value == null) return null;
  if (typeof value !== "string") return fail(rule.invalid);
  if (rule.max !== undefined && value.length > rule.max) return fail(rule.tooLong);
  if (rule.test && !rule.test(value)) return fail(rule.testMessage);
  return null;
}

function validateResidentDate(value, invalidMessage) {
  if (value == null) return null;
  return isValidDate(value) ? null : fail(invalidMessage);
}

// The move-out date cannot be earlier than the move-in date, same as the CHECK on the table.
function validateResidentDates(payload) {
  const { move_in_date: moveIn, move_out_date: moveOut } = payload;
  return (
    validateResidentDate(moveIn, "Geçersiz giriş tarihi.") ??
    validateResidentDate(moveOut, "Geçersiz çıkış tarihi.") ??
    (moveIn != null && moveOut != null && moveOut < moveIn ? fail("Çıkış tarihi giriş tarihinden önce olamaz.") : null)
  );
}

// Trims first, so it can be chained after a scope validator. Runs on both add and update.
function validateResidentFields(payload) {
  normalizeResidentData(payload);

  for (const rule of OPTIONAL_TEXT_RULES) {
    const error = validateOptionalText(payload[rule.field], rule);
    if (error) return error;
  }

  return validateResidentDates(payload);
}

// Only moveOutResident may write that date, so the update channel says no instead of quietly
// dropping it.
function rejectMoveOutDate(payload) {
  if (payload.move_out_date == null) return null;
  return fail("Çıkış tarihi bu işlemle değiştirilemez, sakin çıkışı işlemini kullanın.");
}

// Named differently from validateOwnedApartmentScope in apartment, which checks another field.
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
  if (!isValidDate(payload.moveOutDate)) {
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
    (payload) => validateResidentScope(payload) ?? validateResidentFields(payload) ?? rejectMoveOutDate(payload),
    residentService.updateResident,
  );
  handle(
    CH.RESIDENT.MOVE_OUT,
    (payload) => validateResidentScope(payload) ?? validateMoveOutDate(payload),
    residentService.moveOutResident,
  );
}

module.exports = registerResidentHandlers;

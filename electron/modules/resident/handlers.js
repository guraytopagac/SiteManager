// Resident IPC entry points. Apart from the apartment link, the kind of record and the household
// size, every field is optional, so those checks come from a table instead of one if block per
// field.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const {
  fail,
  isValidDate,
  isValidEmail,
  validateBuildingScope,
  validateId,
  validatePeriod,
} = require("../shared/validate");
const { trToday } = require("../shared/trTime");
const residentService = require("./service");

// Rules that only residents have. Shared limits such as date and email come from shared/validate.js.
// RESIDENT_TYPES matches the schema CHECK and RESIDENT_TYPE_LABELS in src/utils/constants.js.
const RESIDENT_TYPES = ["owner", "tenant"];
const PHONE_RE = /^[1-9][0-9]{9}$/;
const NON_ASCII_RE = /[^\x20-\x7E]/;
const NATIONAL_ID_RE = /^[0-9]{11}$/;

const TRIMMED_FIELDS = ["full_name", "phone", "email", "national_id", "resident_type", "move_out_date"];

// Checked in order, and the first failure wins. Email appears twice, because the character check
// and the format check need different messages.
const OPTIONAL_TEXT_RULES = [
  { field: "full_name", invalid: "Geçersiz ad soyad.", max: 60, tooLong: "Ad soyad en fazla 60 karakter olabilir." },
  {
    field: "phone",
    invalid: "Geçersiz telefon numarası.",
    test: (value) => PHONE_RE.test(value),
    testMessage: "Telefon numarası başında 0 olmadan 10 haneli olmalıdır (örn. 5455455555).",
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

// Only the add channel may carry this date with the other fields. The update channel rejects it
// below, and the move-out channel has its own required check. A record added today starts today, so
// an earlier date would close it before it opened.
function validateOptionalMoveOutDate(payload) {
  const value = payload.move_out_date;
  if (value == null) return null;
  if (!isValidDate(value)) return fail("Geçersiz çıkış tarihi.");
  return value < trToday() ? fail("Çıkış tarihi bugünden önce olamaz.") : null;
}

// Which of the two records this is. Required, because an apartment holds one row of each kind and
// this field is the only thing telling them apart.
function validateResidentType(payload) {
  return RESIDENT_TYPES.includes(payload.resident_type) ? null : fail("Geçersiz kayıt türü.");
}

// Only an owner can be recorded without living in the flat, so only an owner has to answer this.
// A tenant is always the occupant and the service writes the flag itself.
function validateOccupancy(payload) {
  if (payload.resident_type !== "owner") return null;
  if (typeof payload.is_occupant !== "boolean") {
    return fail("Malikin dairede oturup oturmadığı belirtilmelidir.");
  }
  return null;
}

// Optional, because the user may not know it. A null means unknown and the building list's sum
// skips that row. A given value matches the range in the CHECK on the column.
function validateHouseholdSize(payload) {
  const value = payload.household_size;
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    return fail("Dairede yaşayan kişi sayısı 1 ile 20 arasında bir tam sayı olmalıdır.");
  }
  return null;
}

// Trims first, so it can be chained after a scope validator. Runs on both add and update.
function validateResidentFields(payload) {
  normalizeResidentData(payload);

  const typeError = validateResidentType(payload);
  if (typeError) return typeError;

  for (const rule of OPTIONAL_TEXT_RULES) {
    const error = validateOptionalText(payload[rule.field], rule);
    if (error) return error;
  }

  return validateHouseholdSize(payload) ?? validateOccupancy(payload) ?? validateOptionalMoveOutDate(payload);
}

// The move-out channel may carry the record that replaces the one being closed, whether the exit is
// dated today or ahead. The fields are the same ones the add channel takes, so they go through the
// same validator: an optional payload still has to be a complete record once it is there.
// resident_type comes along and the service checks it against the record being closed, which is what
// keeps the validated role and the written role the same. A move-out date on the new record makes no
// sense, so it is rejected rather than dropped, and its start date is not the caller's to send: the
// service derives it from the transfer date.
function validateNextResident(payload) {
  const next = payload.next;
  if (next == null) return null;
  if (typeof next !== "object" || Array.isArray(next)) return fail("Yeni kayıt bilgileri geçersiz.");

  const error = validateResidentFields(next);
  if (error) return error;

  return next.move_out_date == null ? null : fail("Yeni kayıt için çıkış tarihi girilemez.");
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

  handle(
    CH.RESIDENT.GET_OVERVIEW,
    (payload) =>
      validateBuildingScope(payload) ?? validatePeriod(payload, "Gelecek bir dönemin sakin listesi görüntülenemez."),
    residentService.getResidentsOverview,
  );
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
    (payload) => validateResidentScope(payload) ?? validateMoveOutDate(payload) ?? validateNextResident(payload),
    residentService.moveOutResident,
  );
  handle(
    CH.RESIDENT.UPDATE_MOVE_OUT,
    (payload) => validateResidentScope(payload) ?? validateMoveOutDate(payload) ?? validateNextResident(payload),
    residentService.updateScheduledMoveOut,
  );
  handle(CH.RESIDENT.CANCEL_MOVE_OUT, validateResidentScope, residentService.cancelScheduledMoveOut);
}

module.exports = registerResidentHandlers;

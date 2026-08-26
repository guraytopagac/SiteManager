// Auth IPC entry points. Passwords are never trimmed, because a space may be part of the password.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/handler");
const { fail, isValidEmail, noValidation, validateId, validatePayload } = require("../shared/validate");
const authService = require("./service");

// Same rule as the username CHECK on the users table.
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

// Trimming happens here only. The service never trims again.
function trimField(payload, field) {
  if (typeof payload[field] === "string") {
    payload[field] = payload[field].trim();
  }
}

function validateAccountScope(payload) {
  return validatePayload(payload) ?? validateId(payload.userId, "hesap ID");
}

function validatePassword(value, message = "Şifre en az 8 karakter olmalıdır.") {
  if (typeof value !== "string" || value.length < 8) {
    return fail(message);
  }
  return null;
}

function validatePersonName(value, message) {
  if (typeof value !== "string" || value.length < 2 || value.length > 60) {
    return fail(message);
  }
  return null;
}

// Presence only. The service checks the password against the hash.
function validateRequiredPassword(payload) {
  if (typeof payload.password !== "string" || !payload.password) {
    return fail("Şifre zorunludur.");
  }
  return null;
}

function validateLoginFields(payload) {
  trimField(payload, "username");
  if (
    typeof payload.username !== "string" ||
    !payload.username ||
    typeof payload.password !== "string" ||
    !payload.password
  ) {
    return fail("Kullanıcı adı ve şifre zorunludur.");
  }
  return null;
}

function validateChangePasswordFields(payload) {
  if (typeof payload.oldPassword !== "string" || !payload.oldPassword || !payload.newPassword) {
    return fail("Mevcut şifre ve yeni şifre zorunludur.");
  }
  return validatePassword(payload.newPassword);
}

// Email is optional. An empty value becomes null, which removes the stored address.
function validateEmailField(payload) {
  trimField(payload, "email");
  const { email } = payload;
  if (email == null || email === "") {
    payload.email = null;
    return null;
  }
  if (!isValidEmail(email)) {
    return fail("Geçerli bir e-posta adresi girin.");
  }
  return null;
}

function validateTransferFields(payload) {
  trimField(payload, "newPerson");
  if (typeof payload.password !== "string" || !payload.password) {
    return fail("Mevcut şifre zorunludur.");
  }
  if (typeof payload.newPerson !== "string" || !payload.newPerson) {
    return fail("Yeni yöneticinin adı zorunludur.");
  }
  return validatePersonName(payload.newPerson, "Yönetici adı 2 ile 60 karakter arasında olmalıdır.");
}

function validateResetFields(payload) {
  if (typeof payload.recoveryCode !== "string" || !payload.recoveryCode || !payload.newPassword) {
    return fail("Kurtarma kodu ve yeni şifre zorunludur.");
  }
  return validatePassword(payload.newPassword);
}

function validateRecoveryCodeField(payload) {
  if (typeof payload.recoveryCode !== "string" || !payload.recoveryCode) {
    return fail("Kurtarma kodu zorunludur.");
  }
  return null;
}

function validateSetupFields(payload) {
  trimField(payload, "username");
  trimField(payload, "managerName");
  if (typeof payload.username !== "string" || !USERNAME_RE.test(payload.username)) {
    return fail("Kullanıcı adı 3-30 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.");
  }
  return (
    validateRequiredPassword(payload) ??
    validatePassword(payload.password) ??
    validatePersonName(payload.managerName, "Ad soyad 2 ile 60 karakter arasında olmalıdır.")
  );
}

function registerAuthHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "auth");

  handle(CH.AUTH.LOGIN, (payload) => validatePayload(payload) ?? validateLoginFields(payload), authService.login);
  handle(
    CH.AUTH.CHANGE_PASSWORD,
    (payload) => validateAccountScope(payload) ?? validateChangePasswordFields(payload),
    authService.changePassword,
  );
  handle(
    CH.AUTH.UPDATE_EMAIL,
    (payload) => validateAccountScope(payload) ?? validateEmailField(payload),
    authService.updateEmail,
  );
  handle(
    CH.AUTH.TRANSFER_ACCOUNT,
    (payload) => validateAccountScope(payload) ?? validateTransferFields(payload),
    authService.transferAccount,
  );
  handle(
    CH.AUTH.RESET_ACCOUNT_PASSWORD,
    (payload) => validatePayload(payload) ?? validateResetFields(payload),
    authService.resetAccountPassword,
  );
  handle(
    CH.AUTH.VERIFY_RECOVERY_CODE,
    (payload) => validatePayload(payload) ?? validateRecoveryCodeField(payload),
    authService.verifyRecoveryCode,
  );
  handle(
    CH.AUTH.REGENERATE_RECOVERY_CODE,
    (payload) => validatePayload(payload) ?? validateRequiredPassword(payload),
    authService.regenerateRecoveryCode,
  );
  handle(CH.AUTH.GET_SETUP_STATE, noValidation, authService.getSetupState);
  handle(
    CH.AUTH.COMPLETE_SETUP,
    (payload) => validatePayload(payload) ?? validateSetupFields(payload),
    authService.completeSetup,
  );
}

module.exports = registerAuthHandlers;

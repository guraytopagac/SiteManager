const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const authService = require("./service");

const safeHandler = createSafeHandler("auth");

const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;

function normalizeIdentityFields(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return;
  }
  if (typeof data.username === "string") {
    data.username = data.username.trim();
  }
  if (typeof data.email === "string") {
    data.email = data.email.trim();
  }
}

function validateLoginData(credentials) {
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    return { success: false, message: "Geçersiz istek." };
  }
  normalizeIdentityFields(credentials);
  if (!credentials.username || !credentials.password) {
    return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };
  }
  return null;
}

function validateTransferAccountData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof payload.newPerson === "string") {
    payload.newPerson = payload.newPerson.trim();
  }
  const { userId, password, newPerson } = payload;
  if (!Number.isInteger(userId) || userId <= 0) {
    return { success: false, message: "Geçersiz hesap ID." };
  }
  if (typeof password !== "string" || !password) {
    return { success: false, message: "Mevcut şifre zorunludur." };
  }
  if (typeof newPerson !== "string" || !newPerson) {
    return { success: false, message: "Yeni yöneticinin adı zorunludur." };
  }
  if (newPerson.length < MIN_NAME_LENGTH || newPerson.length > MAX_NAME_LENGTH) {
    return { success: false, message: "Yönetici adı 2 ile 60 karakter arasında olmalıdır." };
  }
  return null;
}

function validateChangePasswordData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { userId, oldPassword, newPassword } = payload;
  if (!Number.isInteger(userId) || userId <= 0 || !oldPassword || !newPassword) {
    return { success: false, message: "Eksik parametre." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
  }
  return null;
}

function validateUpdateEmailData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof payload.email === "string") {
    payload.email = payload.email.trim();
  }
  const { userId, email } = payload;
  if (!Number.isInteger(userId) || userId <= 0) {
    return { success: false, message: "Geçersiz hesap ID." };
  }
  if (email === "" || email === null || email === undefined) {
    payload.email = null;
    return null;
  }
  if (typeof email !== "string" || email.length < MIN_EMAIL_LENGTH || email.length > MAX_EMAIL_LENGTH) {
    return { success: false, message: "E-posta adresi 5 ile 254 karakter arasında olmalıdır." };
  }
  if (!EMAIL_RE.test(email)) {
    return { success: false, message: "Geçerli bir e-posta adresi girin." };
  }
  return null;
}

function validateResetAccountPasswordData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { recoveryCode, newPassword } = data;
  if (typeof recoveryCode !== "string" || typeof newPassword !== "string" || !recoveryCode || !newPassword) {
    return { success: false, message: "Kurtarma kodu ve yeni şifre zorunludur." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
  }
  return null;
}

function validateVerifyRecoveryCodeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof data.recoveryCode !== "string" || !data.recoveryCode) {
    return { success: false, message: "Kurtarma kodu zorunludur." };
  }
  return null;
}

function validateRegenerateRecoveryCodeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { password } = data;
  if (typeof password !== "string" || !password) {
    return { success: false, message: "Şifre zorunludur." };
  }
  return null;
}

function validateCompleteSetupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof data.username === "string") {
    data.username = data.username.trim();
  }
  if (typeof data.managerName === "string") {
    data.managerName = data.managerName.trim();
  }
  const { username, password, managerName } = data;
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return {
      success: false,
      message: "Kullanıcı adı 3-30 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.",
    };
  }
  if (typeof password !== "string" || !password) {
    return { success: false, message: "Şifre zorunludur." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
  }
  if (
    typeof managerName !== "string" ||
    managerName.length < MIN_NAME_LENGTH ||
    managerName.length > MAX_NAME_LENGTH
  ) {
    return { success: false, message: "Ad soyad 2 ile 60 karakter arasında olmalıdır." };
  }
  return null;
}

function registerAuthHandlers(ipcMain) {
  ipcMain.handle(
    CH.AUTH.LOGIN,
    safeHandler(CH.AUTH.LOGIN, (credentials) => {
      const error = validateLoginData(credentials);
      if (error) {
        return error;
      }
      return authService.login(credentials);
    }),
  );

  ipcMain.handle(
    CH.AUTH.TRANSFER_ACCOUNT,
    safeHandler(CH.AUTH.TRANSFER_ACCOUNT, (payload) => {
      const error = validateTransferAccountData(payload);
      if (error) {
        return error;
      }
      return authService.transferAccount(payload.userId, payload.password, payload.newPerson);
    }),
  );

  ipcMain.handle(
    CH.AUTH.CHANGE_PASSWORD,
    safeHandler(CH.AUTH.CHANGE_PASSWORD, (payload) => {
      const error = validateChangePasswordData(payload);
      if (error) {
        return error;
      }
      return authService.changePassword(payload.userId, payload.oldPassword, payload.newPassword);
    }),
  );

  ipcMain.handle(
    CH.AUTH.UPDATE_EMAIL,
    safeHandler(CH.AUTH.UPDATE_EMAIL, (payload) => {
      const error = validateUpdateEmailData(payload);
      if (error) {
        return error;
      }
      return authService.updateEmail(payload.userId, payload.email);
    }),
  );

  ipcMain.handle(
    CH.AUTH.RESET_ACCOUNT_PASSWORD,
    safeHandler(CH.AUTH.RESET_ACCOUNT_PASSWORD, (data) => {
      const error = validateResetAccountPasswordData(data);
      if (error) {
        return error;
      }
      return authService.resetAccountPassword(data.recoveryCode, data.newPassword);
    }),
  );

  ipcMain.handle(
    CH.AUTH.VERIFY_RECOVERY_CODE,
    safeHandler(CH.AUTH.VERIFY_RECOVERY_CODE, (data) => {
      const error = validateVerifyRecoveryCodeData(data);
      if (error) {
        return error;
      }
      return authService.verifyRecoveryCode(data.recoveryCode);
    }),
  );

  ipcMain.handle(
    CH.AUTH.REGENERATE_RECOVERY_CODE,
    safeHandler(CH.AUTH.REGENERATE_RECOVERY_CODE, (data) => {
      const error = validateRegenerateRecoveryCodeData(data);
      if (error) {
        return error;
      }
      return authService.regenerateRecoveryCode(data.password);
    }),
  );

  ipcMain.handle(
    CH.AUTH.GET_SETUP_STATE,
    safeHandler(CH.AUTH.GET_SETUP_STATE, () => authService.getSetupState()),
  );

  ipcMain.handle(
    CH.AUTH.COMPLETE_SETUP,
    safeHandler(CH.AUTH.COMPLETE_SETUP, (data) => {
      const error = validateCompleteSetupData(data);
      if (error) {
        return error;
      }
      return authService.completeSetup(data.username, data.password, data.managerName);
    }),
  );
}

module.exports = registerAuthHandlers;

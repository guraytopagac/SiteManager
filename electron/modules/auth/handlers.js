const { DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL } = require("../../../database/seed");
const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const authService = require("./service");

const safeHandler = createSafeHandler("auth");

const USERNAME_RE = /^[A-Za-z0-9_]{3,}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NON_ASCII_RE = /[^\x20-\x7E]/;
const MIN_PASSWORD_LENGTH = 8;

function validateEmailFormat(email) {
  if (email.length > 254) {
    return "E-posta adresi çok uzun (en fazla 254 karakter).";
  }
  if (NON_ASCII_RE.test(email)) {
    return "E-posta adresinde Türkçe veya özel karakter kullanılamaz.";
  }
  if (!EMAIL_RE.test(email)) {
    return "Geçerli bir e-posta adresi girin (örn. ornek@site.com).";
  }
  return null;
}

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
  if (!credentials.username || !credentials.password) {
    return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };
  }
  return null;
}

function validateCreateManagerData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { username, password, email } = data;
  if (!username || !password || !email) {
    return { success: false, message: "Kullanıcı adı, şifre ve e-posta zorunludur." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
  }
  const emailError = validateEmailFormat(email);
  if (emailError) {
    return { success: false, message: emailError };
  }
  if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, message: "Bu e-posta adresi kullanılamaz." };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      success: false,
      message: "Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.",
    };
  }
  if (username.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase()) {
    return { success: false, message: "Bu kullanıcı adı kullanılamaz." };
  }
  return null;
}

function validateUpdateManagerStatusData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { id, isActive } = payload;
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Geçersiz kullanıcı ID." };
  }
  if (typeof isActive !== "boolean") {
    return { success: false, message: "Geçersiz durum değeri." };
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

function validateResetAdminPasswordData(data) {
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
  const { password } = data;
  if (typeof password !== "string" || !password) {
    return { success: false, message: "Şifre zorunludur." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
  }
  return null;
}

function registerAuthHandlers(ipcMain) {
  ipcMain.handle(
    CH.AUTH.LOGIN,
    safeHandler(CH.AUTH.LOGIN, (credentials) => {
      normalizeIdentityFields(credentials);
      const error = validateLoginData(credentials);
      if (error) {
        return error;
      }
      return authService.login(credentials);
    }),
  );

  ipcMain.handle(
    CH.AUTH.GET_MANAGERS,
    safeHandler(CH.AUTH.GET_MANAGERS, () => authService.getManagers()),
  );

  ipcMain.handle(
    CH.AUTH.CREATE_MANAGER,
    safeHandler(CH.AUTH.CREATE_MANAGER, (data) => {
      normalizeIdentityFields(data);
      const error = validateCreateManagerData(data);
      if (error) {
        return error;
      }
      return authService.createManager(data);
    }),
  );

  ipcMain.handle(
    CH.AUTH.UPDATE_MANAGER_STATUS,
    safeHandler(CH.AUTH.UPDATE_MANAGER_STATUS, (payload) => {
      const error = validateUpdateManagerStatusData(payload);
      if (error) {
        return error;
      }
      return authService.updateManagerStatus(payload.id, payload.isActive);
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
    CH.AUTH.RESET_ADMIN_PASSWORD,
    safeHandler(CH.AUTH.RESET_ADMIN_PASSWORD, (data) => {
      const error = validateResetAdminPasswordData(data);
      if (error) {
        return error;
      }
      return authService.resetAdminPassword(data.recoveryCode, data.newPassword);
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
      return authService.completeAdminSetup(data.password);
    }),
  );
}

module.exports = registerAuthHandlers;

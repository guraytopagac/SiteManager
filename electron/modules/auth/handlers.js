const { DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL } = require("../../../database/seed");
const CH = require("../../ipc/channels");
const authService = require("./service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle(CH.AUTH.LOGIN, (event, credentials) => {
    if (!credentials || typeof credentials !== "object") {
      return { success: false, message: "Geçersiz istek." };
    }
    if (!credentials.username || !credentials.password) {
      return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };
    }
    try {
      return authService.login(credentials);
    } catch (err) {
      console.error("[auth.handlers] LOGIN:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.GET_MANAGERS, () => {
    try {
      return authService.getManagers();
    } catch (err) {
      console.error("[auth.handlers] GET_MANAGERS:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.CREATE_MANAGER, (event, data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, message: "Geçersiz istek." };
    }
    const { username, password, email } = data;
    if (!username || !password || !email) {
      return { success: false, message: "Kullanıcı adı, şifre ve e-posta zorunludur." };
    }
    if (password.length < 8) {
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return { success: false, message: "Geçerli bir e-posta adresi girin (Türkçe karakter kullanılamaz)." };
    }
    // Reserved for the seeded admin account.
    if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: "Bu e-posta adresi kullanılamaz." };
    }
    if (!/^[A-Za-z0-9_]{3,}$/.test(username)) {
      return {
        success: false,
        message: "Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.",
      };
    }
    // Reserved for the seeded admin account (username is COLLATE NOCASE).
    if (username.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase()) {
      return { success: false, message: "Bu kullanıcı adı kullanılamaz." };
    }
    try {
      return authService.createManager(data);
    } catch (err) {
      console.error("[auth.handlers] CREATE_MANAGER:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.UPDATE_MANAGER_STATUS, (event, { id, isActive }) => {
    if (!id || typeof id !== "number" || id <= 0) {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (typeof isActive !== "boolean") {
      return { success: false, message: "Geçersiz durum değeri." };
    }
    try {
      return authService.updateManagerStatus(id, isActive);
    } catch (err) {
      console.error("[auth.handlers] UPDATE_MANAGER_STATUS:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.CHANGE_PASSWORD, (event, { userId, oldPassword, newPassword }) => {
    if (!userId || typeof userId !== "number" || userId <= 0 || !oldPassword || !newPassword) {
      return { success: false, message: "Eksik parametre." };
    }
    if (newPassword.length < 8) {
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    }
    try {
      return authService.changePassword(userId, oldPassword, newPassword);
    } catch (err) {
      console.error("[auth.handlers] CHANGE_PASSWORD:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.RESET_ADMIN_PASSWORD, (event, data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, message: "Geçersiz istek." };
    }
    const { recoveryCode, newPassword } = data;
    if (typeof recoveryCode !== "string" || typeof newPassword !== "string" || !recoveryCode || !newPassword) {
      return { success: false, message: "Kurtarma kodu ve yeni şifre zorunludur." };
    }
    if (newPassword.length < 8) {
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    }
    try {
      return authService.resetAdminPassword(recoveryCode, newPassword);
    } catch (err) {
      console.error("[auth.handlers] RESET_ADMIN_PASSWORD:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.REGENERATE_RECOVERY_CODE, (event, data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, message: "Geçersiz istek." };
    }
    const { password } = data;
    if (typeof password !== "string" || !password) {
      return { success: false, message: "Şifre zorunludur." };
    }
    try {
      return authService.regenerateRecoveryCode(password);
    } catch (err) {
      console.error("[auth.handlers] REGENERATE_RECOVERY_CODE:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.GET_SETUP_STATE, () => {
    try {
      return authService.getSetupState();
    } catch (err) {
      console.error("[auth.handlers] GET_SETUP_STATE:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.COMPLETE_SETUP, (event, data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, message: "Geçersiz istek." };
    }
    const { password } = data;
    if (typeof password !== "string" || !password) {
      return { success: false, message: "Şifre zorunludur." };
    }
    if (password.length < 8) {
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    }
    try {
      return authService.completeAdminSetup(password);
    } catch (err) {
      console.error("[auth.handlers] COMPLETE_SETUP:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerAuthHandlers;

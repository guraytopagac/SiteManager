const authService = require("../services/auth.service");
const CH = require("./channels");

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
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return { success: false, message: "Geçerli bir e-posta adresi girin (Türkçe karakter kullanılamaz)." };
    }
    if (!/^[A-Za-z0-9_]{3,}$/.test(username)) {
      return {
        success: false,
        message: "Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.",
      };
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
}

module.exports = registerAuthHandlers;

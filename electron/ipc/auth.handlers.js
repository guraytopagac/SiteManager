const authService = require("../services/auth.service");
const CH = require("./channels");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle(CH.AUTH.LOGIN, async (event, credentials) => {
    if (!credentials || typeof credentials !== "object") {
      return { success: false, message: "Geçersiz istek." };
    }
    try {
      return await authService.login(credentials);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.GET_MANAGERS, async () => {
    try {
      return await authService.getManagers();
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.CREATE_MANAGER, async (event, data) => {
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
    try {
      return await authService.createManager(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.UPDATE_MANAGER_STATUS, async (event, { id, isActive }) => {
    if (!id || typeof id !== "number" || id <= 0) {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (typeof isActive !== "boolean") {
      return { success: false, message: "Geçersiz durum değeri." };
    }
    try {
      return await authService.updateManagerStatus(id, isActive);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.AUTH.CHANGE_PASSWORD, async (event, { userId, oldPassword, newPassword }) => {
    if (!userId || typeof userId !== "number" || !oldPassword || !newPassword) {
      return { success: false, message: "Eksik parametre." };
    }
    if (newPassword.length < 8) {
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    }
    try {
      return await authService.changePassword(userId, oldPassword, newPassword);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

}

module.exports = registerAuthHandlers;

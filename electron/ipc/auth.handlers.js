const authService = require("../services/auth.service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle("login", async (event, credentials) => {
    if (!credentials?.username || !credentials?.password) {
      return { success: false, message: "Kullanıcı adı ve şifre gereklidir." };
    }
    try {
      return await authService.login(credentials);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("get-managers", async () => {
    try {
      return await authService.getManagers();
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("create-manager", async (event, data) => {
    const { username, password, email } = data ?? {};
    if (!username || !password || !email) {
      return { success: false, message: "Kullanıcı adı, şifre ve e-posta zorunludur." };
    }
    if (password.length < 6) {
      return { success: false, message: "Şifre en az 6 karakter olmalıdır." };
    }
    try {
      return await authService.createManager(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("update-manager-status", async (event, { id, isActive }) => {
    if (!id || typeof id !== "number") {
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

  ipcMain.handle("change-password", async (event, { userId, oldPassword, newPassword }) => {
    if (!userId || !oldPassword || !newPassword) {
      return { success: false, message: "Eksik parametre." };
    }
    if (newPassword.length < 6) {
      return { success: false, message: "Şifre en az 6 karakter olmalıdır." };
    }
    try {
      return await authService.changePassword(userId, oldPassword, newPassword);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerAuthHandlers;

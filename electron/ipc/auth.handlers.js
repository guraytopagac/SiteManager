const authService = require("../services/auth.service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle("login", async (event, credentials) => {
    try {
      return await authService.login(credentials);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("get-managers", async () => {
    try {
      return await authService.getManagers();
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("create-manager", async (event, data) => {
    try {
      return await authService.createManager(data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("update-manager-status", async (event, { id, isActive }) => {
    try {
      return await authService.updateManagerStatus(id, isActive);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("change-password", async (event, { userId, oldPassword, newPassword }) => {
    try {
      return await authService.changePassword(userId, oldPassword, newPassword);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = registerAuthHandlers;

const authService = require("../services/auth.service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle("login", (event, credentials) => authService.login(credentials));
  ipcMain.handle("get-managers", () => authService.getManagers());
  ipcMain.handle("create-manager", (event, data) => authService.createManager(data));
  ipcMain.handle("update-manager-status", (event, { id, isActive }) => authService.updateManagerStatus(id, isActive));
  ipcMain.handle("change-password", (event, { userId, oldPassword, newPassword }) =>
    authService.changePassword(userId, oldPassword, newPassword),
  );
}

module.exports = registerAuthHandlers;

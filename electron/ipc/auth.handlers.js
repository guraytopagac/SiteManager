const authService = require("../services/auth.service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle("login", (event, credentials) => authService.login(credentials));
  ipcMain.handle("register", (event, userData) => authService.register(userData));
  ipcMain.handle("get-managers", () => authService.getManagers());
  ipcMain.handle("create-manager", (event, data) => authService.createManager(data));
  ipcMain.handle("update-manager-status", (event, { id, isActive }) => authService.updateManagerStatus(id, isActive));
}

module.exports = registerAuthHandlers;

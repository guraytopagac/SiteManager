const authService = require("../services/auth.service");

function registerAuthHandlers(ipcMain) {
  ipcMain.handle("login", (event, credentials) => authService.login(credentials));
  ipcMain.handle("register", (event, userData) => authService.register(userData));
}

module.exports = registerAuthHandlers;

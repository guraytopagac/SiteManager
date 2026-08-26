// The only domain with no service. It returns the app version and nothing else.
const { app } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");

// Calls ipcMain.handle directly, because it returns a plain string, not a { success } object.
function registerSystemHandlers(ipcMain) {
  ipcMain.handle(CH.SYSTEM.GET_APP_VERSION, () => app.getVersion());
}

module.exports = registerSystemHandlers;

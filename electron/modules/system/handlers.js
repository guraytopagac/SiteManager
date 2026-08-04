const { app } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");

function registerSystemHandlers(ipcMain) {
  ipcMain.handle(CH.SYSTEM.GET_APP_VERSION, () => app.getVersion());
}

module.exports = registerSystemHandlers;

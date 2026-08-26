// Shared IPC wrapper. It knows nothing about the domains, so a channel name is written once.
function createHandle(ipcMain, domain) {
  return function handle(channel, validate, run, errorMessage = "İşlem sırasında bir hata oluştu.") {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        // A validator returns an error object or null, so ?? runs the body only when the payload is valid.
        return await (validate(payload) ?? run(payload));
      } catch (err) {
        // Only unexpected errors reach this. A broken business rule is returned, never thrown.
        console.error(`[${domain}.handlers] ${channel}:`, err);
        return { success: false, message: errorMessage };
      }
    });
  };
}

module.exports = { createHandle };

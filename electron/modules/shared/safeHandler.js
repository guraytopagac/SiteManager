function createHandle(ipcMain, domain) {
  return function handle(channel, validate, run, errorMessage = "İşlem sırasında bir hata oluştu.") {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        return await (validate(payload) ?? run(payload));
      } catch (err) {
        console.error(`[${domain}.handlers] ${channel}:`, err);
        return { success: false, message: errorMessage };
      }
    });
  };
}

module.exports = { createHandle };

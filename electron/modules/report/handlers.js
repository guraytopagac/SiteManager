// Report IPC entry points. One returns the monthly data, the other saves the PDF.
const fs = require("fs");
const { dialog } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/handler");
const { getMainWindow } = require("../../windows/main");
const { fail, validateBuildingScope, validatePayload, validatePeriod } = require("../shared/validate");
const reportService = require("./service");

const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönem için rapor alınamaz.";
const MAX_FILENAME_LENGTH = 150;
// Path separators and the characters Windows does not allow in a file name.
const INVALID_FILENAME_RE = /[\\/:*?"<>|]/;

// The renderer builds the PDF and sends it here as a Uint8Array.
function validateSaveFileFields(payload) {
  const { filename, buffer } = payload;
  if (typeof filename !== "string" || !filename || filename.length > MAX_FILENAME_LENGTH) {
    return fail("Geçersiz dosya adı.");
  }
  if (INVALID_FILENAME_RE.test(filename)) {
    return fail("Geçersiz dosya adı.");
  }
  if (!(buffer instanceof Uint8Array) || buffer.byteLength === 0) {
    return fail("Geçersiz dosya içeriği.");
  }
  return null;
}

// The only body that stays in a handler, because it never touches the database. The save box is
// tied to the main window, or Windows can hide it behind the app.
async function saveReportFile(payload) {
  const { filename, buffer } = payload;
  const { filePath, canceled } = await dialog.showSaveDialog(getMainWindow(), {
    title: "Raporu Kaydet",
    defaultPath: filename,
    filters: [{ name: "PDF Dosyası", extensions: ["pdf"] }],
  });

  // Cancelling is not an error. The caller reads the cancelled field, not the message.
  if (canceled || !filePath) return { success: false, cancelled: true, message: "İptal edildi." };

  await fs.promises.writeFile(filePath, Buffer.from(buffer));
  return { success: true, message: `Rapor kaydedildi: ${filePath}` };
}

function registerReportHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "report");

  handle(
    CH.REPORT.GET_DATA,
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload, FUTURE_PERIOD_MESSAGE),
    reportService.getReportData,
  );
  handle(
    CH.REPORT.SAVE_FILE,
    (payload) => validatePayload(payload) ?? validateSaveFileFields(payload),
    saveReportFile,
    "Dosya kaydedilemedi.",
  );
}

module.exports = registerReportHandlers;

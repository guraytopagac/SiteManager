const fs = require("fs");
const { dialog } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../shared/safeHandler");
const { fail, isValidMonth, isValidYear, validateBuildingScope, validatePayload } = require("../shared/validate");
const reportService = require("./service");

function validatePeriod(payload) {
  const { year, month } = payload;
  if (!isValidYear(year) || !isValidMonth(month)) {
    return fail("Geçersiz tarih bilgisi.");
  }
  return null;
}

function validateSaveFileFields(payload) {
  if (typeof payload.filename !== "string" || !payload.filename) {
    return fail("Geçersiz dosya adı.");
  }
  if (!payload.buffer) {
    return fail("Geçersiz dosya içeriği.");
  }
  return null;
}

async function saveReportFile(payload) {
  const { filename, buffer } = payload;
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: "Raporu Kaydet",
    defaultPath: filename,
    filters: [{ name: "PDF Dosyası", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) return { success: false, message: "İptal edildi." };

  await fs.promises.writeFile(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  return { success: true, message: `Rapor kaydedildi: ${filePath}` };
}

function registerReportHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "report");

  handle(
    CH.REPORT.GET_DATA,
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload),
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

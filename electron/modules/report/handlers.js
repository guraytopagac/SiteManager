const fs = require("fs");
const { dialog } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const reportService = require("./service");

const safeHandler = createSafeHandler("report");

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function validateGetReportData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { buildingId, year, month } = payload;
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, message: "Geçersiz tarih bilgisi." };
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { success: false, message: "Geçersiz yıl." };
  }
  return null;
}

function validateSaveFileData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const { filename, buffer } = payload;
  if (!filename || typeof filename !== "string") {
    return { success: false, message: "Geçersiz dosya adı." };
  }
  if (!buffer) {
    return { success: false, message: "Geçersiz dosya içeriği." };
  }
  return null;
}

function registerReportHandlers(ipcMain) {
  ipcMain.handle(
    CH.REPORT.GET_DATA,
    safeHandler(CH.REPORT.GET_DATA, (payload) => {
      const error = validateGetReportData(payload);
      if (error) {
        return error;
      }
      return reportService.getReportData(payload.buildingId, payload.year, payload.month);
    }),
  );

  ipcMain.handle(
    CH.REPORT.SAVE_FILE,
    safeHandler(
      CH.REPORT.SAVE_FILE,
      async (payload) => {
        const error = validateSaveFileData(payload);
        if (error) {
          return error;
        }
        const { filename, buffer } = payload;
        const { filePath, canceled } = await dialog.showSaveDialog({
          title: "Raporu Kaydet",
          defaultPath: filename,
          filters: [{ name: "PDF Dosyası", extensions: ["pdf"] }],
        });

        if (canceled || !filePath) return { success: false, message: "İptal edildi." };

        const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        await fs.promises.writeFile(filePath, buf);
        return { success: true, message: `Rapor kaydedildi: ${filePath}` };
      },
      "Dosya kaydedilemedi.",
    ),
  );
}

module.exports = registerReportHandlers;

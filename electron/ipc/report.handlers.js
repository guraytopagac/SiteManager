const path = require("path");
const fs = require("fs");
const { dialog } = require("electron");
const reportService = require("../services/report.service");

function registerReportHandlers(ipcMain) {
  ipcMain.handle("get-report-data", async (event, { managerId, year, month }) => {
    try {
      return await reportService.getReportData(managerId, year, month);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("save-report-file", async (event, { filename, buffer }) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Raporu Kaydet",
        defaultPath: filename,
        filters: filename.endsWith(".pdf")
          ? [{ name: "PDF Dosyası", extensions: ["pdf"] }]
          : [{ name: "Excel Dosyası", extensions: ["xlsx"] }],
      });

      if (canceled || !filePath) return { success: false, message: "İptal edildi." };

      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      fs.writeFileSync(filePath, buf);
      return { success: true, message: `Rapor kaydedildi: ${filePath}` };
    } catch (err) {
      console.error("Save report error:", err);
      return { success: false, message: "Dosya kaydedilemedi." };
    }
  });
}

module.exports = registerReportHandlers;

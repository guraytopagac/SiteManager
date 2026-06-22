const fs = require("fs");
const { dialog } = require("electron");
const reportService = require("../services/report.service");

function registerReportHandlers(ipcMain) {
  ipcMain.handle("get-report-data", async (event, { managerId, year, month }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    try {
      return await reportService.getReportData(managerId, year, month);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
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

const fs = require("fs");
const { dialog } = require("electron");
const reportService = require("../services/report.service");
const CH = require("./channels");

function registerReportHandlers(ipcMain) {
  ipcMain.handle(CH.REPORTS.GET_DATA, (event, { managerId, year, month }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!year || !month || typeof year !== "number" || typeof month !== "number" || month < 1 || month > 12) {
      return { success: false, message: "Geçersiz tarih bilgisi." };
    }
    if (year < 2000 || year > 2100) {
      return { success: false, message: "Geçersiz yıl." };
    }
    try {
      return reportService.getReportData(managerId, year, month);
    } catch (err) {
      console.error("[Report] getReportData handler error:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.REPORTS.SAVE_FILE, async (event, { filename, buffer }) => {
    if (!filename || typeof filename !== "string") {
      return { success: false, message: "Geçersiz dosya adı." };
    }
    if (!buffer) {
      return { success: false, message: "Geçersiz dosya içeriği." };
    }
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Raporu Kaydet",
        defaultPath: filename,
        filters: [{ name: "PDF Dosyası", extensions: ["pdf"] }],
      });

      if (canceled || !filePath) return { success: false, message: "İptal edildi." };

      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      await fs.promises.writeFile(filePath, buf);
      return { success: true, message: `Rapor kaydedildi: ${filePath}` };
    } catch (err) {
      console.error("[Report] saveFile handler error:", err);
      return { success: false, message: "Dosya kaydedilemedi." };
    }
  });
}

module.exports = registerReportHandlers;

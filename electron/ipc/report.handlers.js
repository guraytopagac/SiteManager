const { dialog } = require("electron");
const fs = require("fs");
const reportService = require("../services/report.service");

function registerReportHandlers(ipcMain) {
  ipcMain.handle("get-report-data", (event, { managerId, year, month }) =>
    reportService.getReportData(managerId, year, month),
  );

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

      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true, message: `Rapor kaydedildi: ${filePath}` };
    } catch (err) {
      console.error("Save report error:", err);
      return { success: false, message: "Dosya kaydedilemedi." };
    }
  });
}

module.exports = registerReportHandlers;

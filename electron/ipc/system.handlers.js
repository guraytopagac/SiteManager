const fs = require("fs");
const path = require("path");
const { app, dialog } = require("electron");

function getDbPath() {
  return app.isPackaged ? path.join(app.getPath("userData"), "database.db") : path.join(__dirname, "../../database.db");
}

function registerSystemHandlers(ipcMain) {
  ipcMain.handle("backup-database", async () => {
    const dbPath = getDbPath();

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Veritabanı Yedeğini Kaydet",
      defaultPath: `mavikent-yedek-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
    });

    if (canceled || !filePath) return { success: false, message: "İptal edildi." };

    return new Promise((resolve) => {
      fs.copyFile(dbPath, filePath, (err) => {
        if (err) return resolve({ success: false, message: "Yedek alınamadı: " + err.message });
        resolve({ success: true, message: "Yedek başarıyla alındı." });
      });
    });
  });

  ipcMain.handle("restore-database", async (event) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: "Yedek Dosyasını Seç",
      filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
      properties: ["openFile"],
    });

    if (canceled || !filePaths.length) return { success: false, message: "İptal edildi." };

    const dbPath = getDbPath();

    return new Promise((resolve) => {
      const tempBackup = dbPath + ".bak";
      fs.copyFile(dbPath, tempBackup, (backupErr) => {
        if (backupErr) return resolve({ success: false, message: "Mevcut veritabanı korunamadı." });

        fs.copyFile(filePaths[0], dbPath, (err) => {
          if (err) {
            fs.copyFile(tempBackup, dbPath, () => {});
            return resolve({ success: false, message: "Geri yükleme başarısız: " + err.message });
          }
          fs.unlink(tempBackup, () => {});
          resolve({ success: true, message: "Veritabanı başarıyla geri yüklendi. Uygulama yeniden başlatılıyor..." });
        });
      });
    });
  });
}

module.exports = registerSystemHandlers;

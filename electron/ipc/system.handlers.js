const fs = require("fs");
const { app, dialog } = require("electron");
const db = require("../../database/db");

function registerSystemHandlers(ipcMain) {
  ipcMain.handle("get-app-version", () => app.getVersion());

  ipcMain.handle("backup-database", async () => {
    const dbPath = db.name;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Veritabanı Yedeğini Kaydet",
      defaultPath: `mavikent-yedek-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
    });

    if (canceled || !filePath) return { success: false, message: "İptal edildi." };

    try {
      await fs.promises.copyFile(dbPath, filePath);
      return { success: true, message: "Yedek başarıyla alındı." };
    } catch {
      return { success: false, message: "Yedek alınamadı." };
    }
  });

  ipcMain.handle("restore-database", async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: "Yedek Dosyasını Seç",
      filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
      properties: ["openFile"],
    });

    if (canceled || !filePaths.length) return { success: false, message: "İptal edildi." };

    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Geri Yükle", "İptal"],
      defaultId: 1,
      message: "Mevcut veritabanının üzerine yazılacak. Emin misiniz?",
    });

    if (response !== 0) return { success: false, message: "İptal edildi." };

    const dbPath = db.name;
    const tempBackup = dbPath + ".bak";

    try {
      await fs.promises.copyFile(dbPath, tempBackup);
    } catch {
      return { success: false, message: "Mevcut veritabanı korunamadı." };
    }

    try {
      await fs.promises.copyFile(filePaths[0], dbPath);
      await fs.promises.unlink(tempBackup).catch(() => {});
      setTimeout(() => {
        app.relaunch();
        app.exit();
      }, 1500);
      return { success: true, message: "Veritabanı başarıyla geri yüklendi. Uygulama yeniden başlatılıyor..." };
    } catch {
      await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
      return { success: false, message: "Geri yükleme başarısız." };
    }
  });
}

module.exports = registerSystemHandlers;

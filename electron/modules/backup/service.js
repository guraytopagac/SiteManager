const fs = require("fs");
const Database = require("better-sqlite3");
const { dialog, app } = require("electron");

async function runBackup(mainWindow) {
  const { db } = require("../../../database/db");
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: "Veritabanının Yedeğini Kaydet",
    defaultPath: `mavikent-yedek-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
  });

  if (!filePath || canceled) return;

  try {
    await db.backup(filePath);
    await fs.promises.unlink(filePath + "-shm").catch(() => {});
    await fs.promises.unlink(filePath + "-wal").catch(() => {});
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Yedekleme",
      message: "Yedek başarıyla alındı.",
      buttons: ["Tamam"],
    });
  } catch (err) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yedekleme Hatası",
      message: "Yedek alınamadı.",
      detail: err.message,
      buttons: ["Tamam"],
    });
  }
}

async function runRestore(mainWindow) {
  const { db, closeDb } = require("../../../database/db");
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Veritabanı Dosyasını Seç",
    filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths.length) return;

  let integrityOk;
  try {
    const testDb = new Database(filePaths[0], { readonly: true });
    const result = testDb.pragma("integrity_check", { simple: true });
    testDb.close();
    integrityOk = result === "ok";
  } catch {
    integrityOk = false;
  }

  if (!integrityOk) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Geçersiz Dosya",
      message: "Seçilen dosya bozuk veya geçerli bir veritabanı değil.",
      buttons: ["Tamam"],
    });
    return;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    message: "Mevcut veritabanının üzerine yazılacak. Emin misiniz?",
    buttons: ["Veritabanını Yükle", "İptal"],
    defaultId: 0,
  });

  if (response !== 0) return;

  const dbPath = db.name;
  const tempBackup = dbPath + ".bak";

  try {
    await fs.promises.copyFile(dbPath, tempBackup);
  } catch (err) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yükleme Hatası",
      message: "Mevcut veritabanı korunamadı.",
      detail: err.message,
      buttons: ["Tamam"],
    });
    return;
  }

  // Close the active connection so Windows releases the file lock
  // Done after temp backup succeeds — closing before would leave the app with no DB on error
  closeDb();

  try {
    await fs.promises.copyFile(filePaths[0], dbPath);
    await fs.promises.unlink(tempBackup).catch(() => {});
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Yükleme",
      message: "Veritabanı başarıyla geri yüklendi. Uygulama yeniden başlatılıyor...",
      buttons: ["Tamam"],
    });
    app.relaunch();
    app.exit();
  } catch (err) {
    await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yükleme Hatası",
      message: "Yükleme başarısız. Önceki veritabanı korundu.",
      detail: err.message,
      buttons: ["Tamam"],
    });
  }
}

module.exports = { runBackup, runRestore };

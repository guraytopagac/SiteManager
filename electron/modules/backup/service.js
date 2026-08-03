const fs = require("fs");
const Database = require("better-sqlite3");
const { dialog, app } = require("electron");
const { trNow, trToday } = require("../shared/trTime");
const { readSettings, writeSetting } = require("../shared/appSettings");

const LAST_BACKUP_KEY = "lastBackupAt";

function getLastBackupAt() {
  const value = readSettings()[LAST_BACKUP_KEY];
  return typeof value === "string" ? value : null;
}

async function runBackup(mainWindow, { silent = false } = {}) {
  const { db } = require("../../../database/db");
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: "Yedek Dosyasını Kaydet",
    defaultPath: `mavikent-yedek-${trToday()}.db`,
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
  });

  if (!filePath || canceled) return { success: false, cancelled: true, message: "İptal edildi." };

  try {
    await db.backup(filePath);
    await fs.promises.unlink(filePath + "-shm").catch(() => {});
    await fs.promises.unlink(filePath + "-wal").catch(() => {});

    const lastBackupAt = trNow().toISOString().slice(0, 19).replace("T", " ");
    writeSetting(LAST_BACKUP_KEY, lastBackupAt);

    if (!silent) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Yedekleme",
        message: "Yedek başarıyla alındı.",
        buttons: ["Tamam"],
      });
    }
    return { success: true, message: "Yedek başarıyla alındı.", lastBackupAt };
  } catch {
    if (!silent) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Yedekleme Hatası",
        message: "Yedek alınamadı.",
        buttons: ["Tamam"],
      });
    }
    return { success: false, message: "Yedek alınamadı." };
  }
}

async function runRestore(mainWindow) {
  const { db, closeDb } = require("../../../database/db");
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Yedek Dosyasını Seç",
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
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
      message: "Seçilen dosya bozuk veya geçerli bir yedek değil.",
      buttons: ["Tamam"],
    });
    return;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    message: "Mevcut tüm verileriniz bu yedekle değiştirilecek. Emin misiniz?",
    buttons: ["Yedeği Geri Yükle", "İptal"],
    defaultId: 0,
  });

  if (response !== 0) return;

  const dbPath = db.name;
  const tempBackup = dbPath + ".bak";

  try {
    await fs.promises.copyFile(dbPath, tempBackup);
  } catch {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Geri Yükleme Hatası",
      message: "Mevcut verileriniz yedeklenemediği için işlem durduruldu.",
      buttons: ["Tamam"],
    });
    return;
  }

  closeDb();

  try {
    await fs.promises.copyFile(filePaths[0], dbPath);
    await fs.promises.unlink(dbPath + "-wal").catch(() => {});
    await fs.promises.unlink(dbPath + "-shm").catch(() => {});
    await fs.promises.unlink(tempBackup).catch(() => {});
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Geri Yükleme",
      message: "Verileriniz geri yüklendi. Uygulama yeniden başlatılıyor...",
      buttons: ["Tamam"],
    });
    app.relaunch();
    app.exit();
  } catch {
    await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
    await fs.promises.unlink(tempBackup).catch(() => {});
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Geri Yükleme Hatası",
      message: "Geri yükleme başarısız oldu. Önceki verileriniz korundu. Uygulama yeniden başlatılıyor...",
      buttons: ["Tamam"],
    });
    app.relaunch();
    app.exit();
  }
}

module.exports = { runBackup, runRestore, getLastBackupAt };

const fs = require("fs");
const Database = require("better-sqlite3");
const { dialog, app } = require("electron");
const { closeDb, getDb } = require("../../../database/db");
const { trToday } = require("../shared/trTime");

const REQUIRED_TABLES = ["users", "buildings", "apartments", "dues"];

const BACKUP_OK_MESSAGE = "Yedek başarıyla alındı.";
const BACKUP_FAIL_MESSAGE = "Yedek alınamadı.";
const CORRUPT_FILE_MESSAGE = "Seçilen dosya bozuk veya geçerli bir yedek değil.";
const FOREIGN_FILE_MESSAGE = "Seçilen dosya bu uygulamanın yedeği değil. Lütfen Mavikent yedek dosyasını seçin.";

function showMessage(mainWindow, options) {
  return dialog.showMessageBox(mainWindow, { buttons: ["Tamam"], ...options });
}

async function removeSidecarFiles(dbPath) {
  await fs.promises.unlink(`${dbPath}-wal`).catch(() => {});
  await fs.promises.unlink(`${dbPath}-shm`).catch(() => {});
}

function validateBackupFile(filePath) {
  let testDb = null;
  try {
    testDb = new Database(filePath, { readonly: true });
    if (testDb.pragma("integrity_check", { simple: true }) !== "ok") {
      return CORRUPT_FILE_MESSAGE;
    }

    const findTable = testDb.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`);
    return REQUIRED_TABLES.every((table) => findTable.get(table)) ? null : FOREIGN_FILE_MESSAGE;
  } catch (err) {
    console.warn("[backup.service] validateBackupFile:", err);
    return CORRUPT_FILE_MESSAGE;
  } finally {
    testDb?.close();
  }
}

async function runBackup(mainWindow, { silent = false } = {}) {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: "Yedek Dosyasını Kaydet",
    defaultPath: `mavikent-yedek-${trToday()}.db`,
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
  });

  if (!filePath || canceled) return { success: false, cancelled: true, message: "İptal edildi." };

  try {
    await getDb().backup(filePath);
    await removeSidecarFiles(filePath);

    if (!silent) {
      await showMessage(mainWindow, { type: "info", title: "Yedekleme", message: BACKUP_OK_MESSAGE });
    }
    return { success: true, message: BACKUP_OK_MESSAGE };
  } catch (err) {
    console.error("[backup.service] runBackup:", err);
    if (!silent) {
      await showMessage(mainWindow, { type: "error", title: "Yedekleme Hatası", message: BACKUP_FAIL_MESSAGE });
    }
    return { success: false, message: BACKUP_FAIL_MESSAGE };
  }
}

async function runRestore(mainWindow) {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Yedek Dosyasını Seç",
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths.length) return;

  const fileError = validateBackupFile(filePaths[0]);
  if (fileError) {
    await showMessage(mainWindow, { type: "error", title: "Geçersiz Dosya", message: fileError });
    return;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    message: "Mevcut tüm verileriniz bu yedekle değiştirilecek. Emin misiniz?",
    buttons: ["Yedeği Geri Yükle", "İptal"],
    defaultId: 0,
  });

  if (response !== 0) return;

  const dbPath = getDb().name;
  const tempBackup = `${dbPath}.bak`;

  try {
    await fs.promises.copyFile(dbPath, tempBackup);
  } catch (err) {
    console.error("[backup.service] runRestore safety copy failed:", err);
    await showMessage(mainWindow, {
      type: "error",
      title: "Geri Yükleme Hatası",
      message: "Mevcut verileriniz yedeklenemediği için işlem durduruldu.",
    });
    return;
  }

  closeDb();

  try {
    await removeSidecarFiles(dbPath);
    await fs.promises.copyFile(filePaths[0], dbPath);
    await showMessage(mainWindow, {
      type: "info",
      title: "Geri Yükleme",
      message: "Verileriniz geri yüklendi. Uygulama yeniden başlatılıyor...",
      detail: `Önceki verilerinizin kopyası şu dosyada saklandı:\n${tempBackup}`,
    });
    app.relaunch();
    app.exit();
  } catch (err) {
    console.error("[backup.service] runRestore failed, rolling back:", err);
    await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
    await showMessage(mainWindow, {
      type: "error",
      title: "Geri Yükleme Hatası",
      message: "Geri yükleme başarısız oldu. Önceki verileriniz korundu. Uygulama yeniden başlatılıyor...",
    });
    app.relaunch();
    app.exit();
  }
}

module.exports = { runBackup, runRestore };

// Backup and restore. It sits in a service, not a handler, because it uses the database
// connection itself through getDb().backup() and closeDb().
const fs = require("fs");
const Database = require("better-sqlite3");
const { dialog, app } = require("electron");
const { closeDb, getDb } = require("../../../database/db");
const { trToday } = require("../shared/trTime");

// Without this check, a healthy SQLite file from another program would pass and overwrite the data.
const REQUIRED_TABLES = ["users", "buildings", "apartments", "dues"];

const BACKUP_OK_MESSAGE = "Yedek başarıyla alındı.";
const BACKUP_FAIL_MESSAGE = "Yedek alınamadı.";
const CORRUPT_FILE_MESSAGE = "Seçilen dosya bozuk veya geçerli bir yedek değil.";
const FOREIGN_FILE_MESSAGE = "Seçilen dosya bu uygulamanın yedeği değil. Lütfen Mavikent yedek dosyasını seçin.";

function showMessage(mainWindow, options) {
  return dialog.showMessageBox(mainWindow, { buttons: ["Tamam"], ...options });
}

// Removes leftover WAL files, which would otherwise belong to the wrong database file.
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
    // Must close, or Windows keeps the file locked and the copy below fails.
    testDb?.close();
  }
}

// Asks where to save, then writes a safe copy while the database is open. Returns the path, or null when
// the user cancels. editCopy touches the copy only, and a failed edit deletes the file instead of shipping it.
async function saveDatabaseCopy(mainWindow, { title, defaultPath, editCopy = null }) {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath,
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
  });

  if (!filePath || canceled) return null;

  await getDb().backup(filePath);
  await removeSidecarFiles(filePath);

  if (editCopy) {
    try {
      const copyDb = new Database(filePath);
      try {
        // Leaves WAL mode, so the edit lands in the file itself and no sidecar travels with it.
        copyDb.pragma("journal_mode = DELETE");
        editCopy(copyDb);
      } finally {
        copyDb.close();
      }
    } catch (err) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw err;
    }
  }

  return filePath;
}

async function runBackup(mainWindow, { silent = false } = {}) {
  try {
    const filePath = await saveDatabaseCopy(mainWindow, {
      title: "Yedek Dosyasını Kaydet",
      defaultPath: `mavikent-yedek-${trToday()}.db`,
    });

    if (!filePath) return { success: false, cancelled: true, message: "İptal edildi." };

    if (!silent) {
      await showMessage(mainWindow, { type: "info", title: "Yedekleme", message: BACKUP_OK_MESSAGE });
    }
    return { success: true, message: filePath };
  } catch (err) {
    console.error("[backup.service] runBackup:", err);
    if (!silent) {
      await showMessage(mainWindow, { type: "error", title: "Yedekleme Hatası", message: BACKUP_FAIL_MESSAGE });
    }
    return { success: false, message: BACKUP_FAIL_MESSAGE };
  }
}

async function pickBackupFile(mainWindow) {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Yedek Dosyasını Seç",
    filters: [{ name: "Yedek Dosyası", extensions: ["db"] }],
    properties: ["openFile"],
  });
  return canceled || !filePaths.length ? null : filePaths[0];
}

// Copies the current database aside, swaps in the chosen file and restarts. It returns only when
// the safety copy fails, with the message to show. Every later path ends in a restart.
async function replaceDatabase(mainWindow, sourcePath, { isInitial }) {
  // The .bak copy is never deleted. It is the only way back after restoring the wrong file.
  const dbPath = getDb().name;
  const tempBackup = `${dbPath}.bak`;

  try {
    await fs.promises.copyFile(dbPath, tempBackup);
  } catch (err) {
    console.error("[backup.service] replaceDatabase safety copy failed:", err);
    return "Mevcut verileriniz yedeklenemediği için işlem durduruldu.";
  }

  // Windows cannot overwrite a locked file, so the connection is closed here and never opened
  // again. That is why both paths below end in a restart.
  closeDb();

  try {
    await removeSidecarFiles(dbPath);
    await fs.promises.copyFile(sourcePath, dbPath);
    // On a fresh install there was nothing to keep, so pointing at the .bak copy would only confuse.
    await showMessage(mainWindow, {
      type: "info",
      title: "Geri Yükleme",
      message: "Verileriniz yüklendi. Uygulama yeniden başlatılıyor...",
      detail: isInitial ? undefined : `Önceki verilerinizin kopyası şu dosyada saklandı:\n${tempBackup}`,
    });
    // relaunch only plans the restart, so exit has to follow it.
    app.relaunch();
    app.exit();
  } catch (err) {
    console.error("[backup.service] replaceDatabase failed, rolling back:", err);
    await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
    await showMessage(mainWindow, {
      type: "error",
      title: "Geri Yükleme Hatası",
      message: "Geri yükleme başarısız oldu. Önceki verileriniz korundu. Uygulama yeniden başlatılıyor...",
    });
    app.relaunch();
    app.exit();
  }
  return null;
}

async function runRestore(mainWindow) {
  const filePath = await pickBackupFile(mainWindow);
  if (!filePath) return;

  const fileError = validateBackupFile(filePath);
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

  const copyError = await replaceDatabase(mainWindow, filePath, { isInitial: false });
  if (copyError) {
    await showMessage(mainWindow, { type: "error", title: "Geri Yükleme Hatası", message: copyError });
  }
}

// Restore from the setup screen, where a new manager loads a file instead of creating an account. No
// confirmation, since there is nothing to lose, and it refuses once an account exists: no session needed.
async function restoreOnSetup(mainWindow) {
  if (getDb().prepare(`SELECT 1 FROM users LIMIT 1`).get()) {
    return { success: false, message: "Bu bilgisayarda kurulu bir hesap var. Yedek, Dosya menüsünden geri yüklenir." };
  }

  const filePath = await pickBackupFile(mainWindow);
  if (!filePath) return { success: false, cancelled: true, message: "İptal edildi." };

  const fileError = validateBackupFile(filePath);
  if (fileError) return { success: false, message: fileError };

  const copyError = await replaceDatabase(mainWindow, filePath, { isInitial: true });
  return { success: false, message: copyError };
}

module.exports = { restoreOnSetup, runBackup, runRestore, saveDatabaseCopy };

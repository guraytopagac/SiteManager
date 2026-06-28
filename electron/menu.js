const { Menu, BrowserWindow, dialog, app, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const CH = require("./ipc/channels");
const { db, closeDb } = require("../database/db");

async function runBackup(mainWindow) {
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
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Veritabanı Dosyasını Seç",
    filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths.length) return;

  let integrityOk = false;
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

let guideWin = null;
function openGuide(iconPath) {
  if (guideWin && !guideWin.isDestroyed()) {
    guideWin.focus();
    return;
  }
  guideWin = new BrowserWindow({
    width: 1200,
    height: 780,
    title: "Kullanım Kılavuzu",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
    resizable: false,
  });
  guideWin.loadFile(path.join(__dirname, "guide", "guide.html"));
  guideWin.on("closed", () => {
    guideWin = null;
  });
}

function buildMenu(mainWindow, isDev, iconPath) {
  const template = [
    {
      label: "Dosya",
      submenu: [
        {
          label: "Veritabanı Yedekle",
          accelerator: "CmdOrCtrl+Shift+B",
          click() {
            runBackup(mainWindow);
          },
        },
        {
          label: "Veritabanı Yükle",
          accelerator: "CmdOrCtrl+Shift+R",
          click() {
            runRestore(mainWindow);
          },
        },
        { type: "separator" },
        { label: "Çıkış", role: "quit" },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        {
          label: "Tema Değiştir",
          accelerator: "CmdOrCtrl+Shift+T",
          click() {
            mainWindow.webContents.send(CH.EVENTS.TOGGLE_THEME);
          },
        },
        { type: "separator" },
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Varsayılan Boyut", role: "resetZoom" },
        { type: "separator" },
        { label: "Yenile", role: "reload", accelerator: "CmdOrCtrl+R" },
        { type: "separator" },
        { label: "Tam Ekran", role: "togglefullscreen" },
      ],
    },
    {
      label: "Yardım",
      submenu: [
        {
          label: "Kullanım Kılavuzu",
          accelerator: "F1",
          click() {
            openGuide(iconPath);
          },
        },
        { type: "separator" },
        {
          label: "Güncellemeleri Kontrol Et",
          async click() {
            try {
              const result = await autoUpdater.checkForUpdates();
              if (!result?.downloadPromise) {
                dialog.showMessageBox(mainWindow, {
                  type: "info",
                  title: "Güncelleme",
                  message: "Uygulamanız güncel.",
                  detail: `Kullandığınız sürüm (${app.getVersion()}) şuan mevcut olan en son sürüm.`,
                  buttons: ["Tamam"],
                });
              }
            } catch {
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Güncelleme",
                message: "Güncelleme kontrolü şu an kullanılamıyor.",
                buttons: ["Tamam"],
              });
            }
          },
        },
        { type: "separator" },
        {
          label: "Hata Bildir",
          click() {
            shell.openExternal(
              "mailto:guray.topagac.dev@gmail.com?subject=Mavikent%20Site%20Y%C3%B6netim%20Sistemi%20-%20Hata%20Bildirimi",
            );
          },
        },
        { type: "separator" },
        {
          label: "Hakkında",
          click() {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Hakkında",
              message: "Mavikent Site Yönetim Sistemi",
              detail: `Sürüm: ${app.getVersion()}\n\nDestek ve sorularınız için:\nguray.topagac.dev@gmail.com`,
              buttons: ["Tamam"],
              icon: iconPath,
            });
          },
        },
      ],
    },
  ];

  if (isDev) {
    template.push({
      label: "Geliştirici Araçları",
      accelerator: "F12",
      role: "toggleDevTools",
    });
  }

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };

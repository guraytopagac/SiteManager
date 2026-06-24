const fs = require("fs");
const path = require("path");
const { Menu, BrowserWindow, dialog, app } = require("electron");
const Database = require("better-sqlite3");
const CH = require("./ipc/channels");
const db = require("../database/db");
const { closeDb } = require("../database/db");

async function runBackup(mainWindow) {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: "Veritabanının Yedeğini Kaydet",
    defaultPath: `mavikent-yedek-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
  });

  if (!filePath || canceled) return;

  try {
    await db.backup(filePath);
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Yedekleme",
      message: "Yedek başarıyla alındı.",
      buttons: ["Tamam"],
    });
  } catch {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yedekleme Hatası",
      message: "Yedek alınamadı.",
      buttons: ["Tamam"],
    });
  }
}

async function runRestore(mainWindow) {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: "Yedek Dosyasını Seç",
    filters: [{ name: "SQLite Veritabanı", extensions: ["db"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths.length) return;

  // Integrity check before asking user
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
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Geçersiz Dosya",
      message: "Seçilen dosya bozuk veya geçerli bir veritabanı değil.",
      buttons: ["Tamam"],
    });
    return;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Yükle", "İptal Et"],
    defaultId: 0,
    message: "Mevcut veritabanının üzerine yazılacak. Emin misiniz?",
  });

  if (response !== 0) return;

  const dbPath = db.name;
  const tempBackup = dbPath + ".bak";

  // Close the active connection so Windows releases the file lock
  closeDb();

  try {
    await fs.promises.copyFile(dbPath, tempBackup);
  } catch {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yükleme Hatası",
      message: "Mevcut veritabanı korunamadı.",
      buttons: ["Tamam"],
    });
    return;
  }

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
  } catch {
    await fs.promises.copyFile(tempBackup, dbPath).catch(() => {});
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Yükleme Hatası",
      message: "Yükleme başarısız. Önceki veritabanı korundu.",
      buttons: ["Tamam"],
    });
  }
}

let guideWin = null;

function openGuide() {
  if (guideWin && !guideWin.isDestroyed()) {
    guideWin.focus();
    return;
  }
  guideWin = new BrowserWindow({
    width: 1000,
    height: 780,
    title: "Kullanım Kılavuzu",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  guideWin.loadFile(path.join(__dirname, "guide", "guide.html"));
  guideWin.on("closed", () => {
    guideWin = null;
  });
}

function createMenuTemplate(mainWindow, isDev, iconPath) {
  const template = [
    {
      label: "Dosya",
      submenu: [
        {
          label: "Tema Değiştir",
          accelerator: "CmdOrCtrl+Shift+T",
          click() {
            mainWindow.webContents.send(CH.EVENTS.TOGGLE_THEME);
          },
        },
        { type: "separator" },
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
        {
          label: "Yazdır",
          accelerator: "CmdOrCtrl+P",
          click() {
            mainWindow.webContents.print();
          },
        },
        { type: "separator" },
        {
          label: "Çıkış",
          role: "quit",
        },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Varsayılan Boyut", role: "resetZoom" },
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
            openGuide();
          },
        },
        { type: "separator" },
        {
          label: "Güncellemeleri Kontrol Et",
          click() {
            try {
              const { autoUpdater } = require("electron-updater");
              autoUpdater.checkForUpdatesAndNotify();
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
      role: "toggleDevTools",
    });
  }

  return template;
}

function buildMenu(mainWindow, isDev, iconPath) {
  return Menu.buildFromTemplate(createMenuTemplate(mainWindow, isDev, iconPath));
}

module.exports = { buildMenu };

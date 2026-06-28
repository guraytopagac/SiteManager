const { app, ipcMain, dialog, clipboard, BrowserWindow, Menu } = require("electron");
const { autoUpdater } = require("electron-updater");
const serve = require("electron-serve").default;
const fs = require("fs");
const path = require("path");
const registerIpcHandlers = require("./ipc/index.js");
const { buildMenu } = require("./menu");
const { runMigrations } = require("../database/migrate");
const { seedAdminAccount } = require("../database/seed");

app.disableHardwareAcceleration();

const isDev = !app.isPackaged;
const loadURL = serve({ directory: path.join(__dirname, "..", "dist") });
let mainWindow;

async function handleSeedResult(seedResult) {
  if (!seedResult || seedResult.alreadyExists || !mainWindow) return;
  let { username, password } = seedResult;
  if (!username || !password) {
    console.error("[Main] Admin account created but credentials missing.");
    return;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "İlk Kurulum — Admin Hesabı",
    message: "Admin hesabı oluşturuldu.",
    detail: `Kullanıcı adı : ${username}\nŞifre         : ${password}\n\nBu şifreyi not alın — bir daha gösterilmeyecek.\nGiriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.`,
    buttons: ["Şifreyi Kopyala", "Masaüstüne Kaydet", "Tamam"],
    defaultId: 0,
    cancelId: 2,
  });

  if (response === 0) {
    clipboard.writeText(password);
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Kopyalandı",
      message: "Şifre panoya kopyalandı.",
      buttons: ["Tamam"],
    });
  } else if (response === 1) {
    const desktopPath = app.getPath("desktop");
    const filePath = path.join(desktopPath, "mavikent-admin-hesabi.txt");
    try {
      fs.writeFileSync(
        filePath,
        `Mavikent Site Yönetimi — Admin Hesabı\n\nKullanıcı adı : ${username}\nŞifre         : ${password}\n\nGiriş yaptıktan sonra bu dosyayı silin.\n`,
        "utf8",
      );
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Kaydedildi",
        message: "Şifre masaüstüne kaydedildi.",
        detail: `${filePath}\n\n⚠️ Giriş yaptıktan sonra bu dosyayı silmeyi unutmayın.`,
        buttons: ["Tamam"],
      });
    } catch (err) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Kayıt Hatası",
        message: "Dosya oluşturulamadı.",
        detail: err.message,
        buttons: ["Tamam"],
      });
    }
  }

  mainWindow.webContents.send("prefill-login", { username, password });
  password = undefined;
  username = undefined;
}

function createMainWindow(db) {
  const iconPath = path.join(__dirname, "../src/assets/icons/icon.ico");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Mavikent Site Yönetimi Uygulaması",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  Menu.setApplicationMenu(buildMenu(mainWindow, isDev, iconPath));

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/");
  } else {
    loadURL(mainWindow);
  }

  mainWindow.once("ready-to-show", async () => {
    mainWindow.maximize();
    mainWindow.show();
    try {
      const seedResult = await seedAdminAccount(db);
      await handleSeedResult(seedResult);
    } catch (err) {
      dialog.showErrorBox("Başlatma Hatası", `Admin hesabı oluşturulamadı:\n${err.message}`);
    }
    if (!isDev) autoUpdater.checkForUpdates();
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

function setupAutoUpdater() {
  autoUpdater.on("checking-for-update", () => console.log("[Main] Checking for updates..."));
  autoUpdater.on("update-not-available", () => console.log("[Main] No update available."));

  autoUpdater.on("update-available", (info) => {
    if (!mainWindow) return;
    mainWindow.setTitle(`Mavikent Site Yönetimi — Yeni sürüm (v${info.version}) indiriliyor...`);
    mainWindow.webContents.send("update-available", { version: info.version });
  });

  autoUpdater.on("download-progress", (progress) => {
    if (!mainWindow) return;
    const percent = Math.round(progress.percent);
    mainWindow.setProgressBar(progress.percent / 100);
    mainWindow.setTitle(`Mavikent Site Yönetimi — Güncelleme İndiriliyor: %${percent}`);
    mainWindow.webContents.send("download-progress", {
      percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", async () => {
    if (!mainWindow) {
      autoUpdater.quitAndInstall();
      return;
    }

    mainWindow.setProgressBar(-1);
    mainWindow.setTitle("Mavikent Site Yönetimi Uygulaması");
    mainWindow.webContents.send("update-downloaded");
    try {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Güncelleme Hazır",
        message: "Güncelleme indirildi.",
        detail: "Uygulamayı yeniden başlatmak ve güncellemeyi yüklemek ister misiniz?",
        buttons: ["Şimdi Yeniden Başlat", "Daha Sonra"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) autoUpdater.quitAndInstall();
    } catch (err) {
      console.error("[Main] Update dialog error:", err.message);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[Main] Update error:", err.message);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Güncelleme Hatası",
        message: "Güncelleme kontrol edilirken bir hata oluştu.",
        detail: err.message,
        buttons: ["Tamam"],
      });
    }
  });
}

const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.mavikent.sitemanager");
  let db;
  try {
    ({ db } = require("../database/db"));
  } catch (err) {
    dialog.showErrorBox("Veritabanı Hatası", `Veritabanı açılamadı:\n${err.message}`);
    app.quit();
    return;
  }
  try {
    runMigrations(db);
    registerIpcHandlers(ipcMain);
    createMainWindow(db);
    if (!isDev) setupAutoUpdater();
  } catch (err) {
    dialog.showErrorBox("Başlatma Hatası", `Uygulama başlatılamadı:\n${err.message}`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());

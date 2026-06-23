// Libraries
const db = require("../database/db");
const fs = require("fs");
const path = require("path");
const serve = require("electron-serve").default;
const registerIpcHandlers = require("./ipc/index.js");
const { autoUpdater } = require("electron-updater");
const { runMigrations } = require("../database/migrate");
const { seedAdminAccount } = require("../database/seed");
const { app, ipcMain, dialog, clipboard, BrowserWindow, Menu } = require("electron");

let mainWindow;
const loadURL = serve({ directory: path.join(__dirname, "..", "dist") });
const isDev = !app.isPackaged;

async function handleSeedResult(seedResult) {
  if (!seedResult || seedResult.alreadyExists || !mainWindow) return;
  const { username, password } = seedResult;
  if (!username || !password) return;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "İlk Kurulum — Admin Hesabı",
    message: "Admin hesabı oluşturuldu.",
    detail: `Kullanıcı adı : ${username}\nŞifre         : ${password}\n\nBu şifreyi not alın — bir daha gösterilmeyecek.\nGiriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.`,
    buttons: ["Şifreyi Kopyala", "Masaüstüne Kaydet (.txt)", "Tamam"],
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
    const filePath = path.join(desktopPath, "mavikent-admin-sifresi.txt");
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

  seedResult = null;
}

function createMenuTemplate(iconPath) {
  const template = [
    {
      label: "Dosya",
      submenu: [
        {
          label: "Tema Değiştir",
          accelerator: "CmdOrCtrl+Shift+T",
          click() {
            mainWindow.webContents.send("toggle-theme");
          },
        },
        {
          label: "Yenile",
          role: "reload",
          accelerator: "CmdOrCtrl+R",
        },
        {
          label: "Çıkış",
          role: "quit",
          accelerator: "CmdOrCtrl+Q",
        },
      ],
    },
    {
      label: "Yardım",
      submenu: [
        {
          label: "Hakkında",
          click() {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Hakkında",
              message: "Mavikent Site Yönetim Sistemi",
              detail: "\nDestek ve sorularınız için:\nguraytopagac@gmail.com",
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

// Main Window
function createMainWindow() {
  const iconPath = path.join(__dirname, "../src/assets/icon.ico");
  const mainMenu = Menu.buildFromTemplate(createMenuTemplate(iconPath));
  Menu.setApplicationMenu(mainMenu);

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
      sandbox: true,
      webSecurity: true,
    },
  });

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

app.whenReady().then(async () => {
  app.setAppUserModelId("com.mavikent.sitemanager");
  try {
    const appliedCount = runMigrations(db);
    if (appliedCount > 0) console.log(`${appliedCount} migration(s) applied.`);
    registerIpcHandlers(ipcMain);
    createMainWindow();
  } catch (err) {
    dialog.showErrorBox("Başlatma Hatası", `Uygulama başlatılamadı:\n${err.message}`);
    app.quit();
  }
});

// App Events
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Auto updater
function setupAutoUpdater() {
  autoUpdater.on("update-available", () => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme Mevcut",
      message: "Yeni bir sürüm bulundu.",
      detail: "Güncelleme arka planda indiriliyor, hazır olduğunda bildirim alacaksınız.",
      buttons: ["Tamam"],
    });
  });

  autoUpdater.on("update-downloaded", async () => {
    if (!mainWindow) return;
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
      console.error("Güncelleme dialog hatası:", err.message);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Güncelleme hatası:", err.message);
  });
}

if (!isDev) setupAutoUpdater();

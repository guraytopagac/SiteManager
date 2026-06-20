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

runMigrations(db);

// Variables
let mainWindow;
const loadURL = serve({ directory: path.join(__dirname, "..", "dist") });
const isDev = !app.isPackaged;

// Menu
const menuTemplate = [
  ...(process.platform === "darwin"
    ? [
        {
          label: app.name,
        },
      ]
    : []),
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
            icon: path.join(__dirname, "../src/assets/icon.ico"),
          });
        },
      },
    ],
  },
];

// Dev Mode
if (isDev) {
  menuTemplate.push({
    label: "Geliştirici Araçları",
    accelerator: "F12",
    click(item, focusedWindow) {
      if (focusedWindow) focusedWindow.toggleDevTools();
    },
  });
}

// Main Window
function createMainWindow() {
  const mainMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(mainMenu);

  const iconPath = path.join(__dirname, "../src/assets/icon.ico");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    if (!isDev) autoUpdater.checkForUpdates();
  });

  mainWindow.on("closed", () => (mainWindow = null));
}
app.whenReady().then(async () => {
  createMainWindow();

  const generatedPassword = seedAdminAccount(db);
  if (generatedPassword) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "İlk Kurulum — Admin Hesabı",
      message: "Admin hesabı oluşturuldu.",
      detail: `Kullanıcı adı : admin\nŞifre         : ${generatedPassword}\n\nBu şifreyi not alın — bir daha gösterilmeyecek.\nGiriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.`,
      buttons: ["Şifreyi Kopyala", "Masaüstüne Kaydet (.txt)", "Tamam"],
      defaultId: 0,
      cancelId: 2,
    });

    if (response === 0) {
      clipboard.writeText(generatedPassword);
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Kopyalandı",
        message: "Şifre panoya kopyalandı.",
        buttons: ["Tamam"],
      });
    } else if (response === 1) {
      const desktopPath = app.getPath("desktop");
      const filePath = path.join(desktopPath, "mavikent-admin-sifresi.txt");
      fs.writeFileSync(
        filePath,
        `Mavikent Site Yönetimi — Admin Hesabı\n\nKullanıcı adı : admin\nŞifre         : ${generatedPassword}\n\nGiriş yaptıktan sonra bu dosyayı silin.\n`,
        "utf8",
      );
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Kaydedildi",
        message: "Şifre masaüstüne kaydedildi.",
        detail: filePath,
        buttons: ["Tamam"],
      });
    }
  }
});

// IPC Handlers
registerIpcHandlers(ipcMain);

// App Events
app.on("before-quit", () => {
  db.close();
});

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
autoUpdater.on("update-available", () => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Güncelleme Mevcut",
    message: "Yeni bir sürüm bulundu.",
    detail: "Güncelleme arka planda indiriliyor, hazır olduğunda bildirim alacaksınız.",
    buttons: ["Tamam"],
  });
});

autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox(mainWindow, {
      type: "info",
      title: "Güncelleme Hazır",
      message: "Güncelleme indirildi.",
      detail: "Uygulamayı yeniden başlatmak ve güncellemeyi yüklemek ister misiniz?",
      buttons: ["Şimdi Yeniden Başlat", "Daha Sonra"],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

autoUpdater.on("error", (err) => {
  console.error("Güncelleme hatası:", err.message);
});

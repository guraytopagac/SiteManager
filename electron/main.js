// Libraries
const path = require("path");
const serve = require("electron-serve").default;
const { app, ipcMain, dialog, BrowserWindow, Menu } = require("electron");
const registerIpcHandlers = require("./ipc/index.js");

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
  });

  mainWindow.on("closed", () => (mainWindow = null));
}
app.whenReady().then(createMainWindow);

// IPC Handlers
registerIpcHandlers(ipcMain);

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

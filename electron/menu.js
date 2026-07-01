const { Menu, dialog, app, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const CH = require("./ipc/channels");
const { runBackup, runRestore } = require("./services/backup.service");
const { openGuide } = require("./windows/guide");
const ICON_PATH = path.join(__dirname, "../assets/icon.ico");

function buildMenu(mainWindow, isDev) {
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
            openGuide();
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
              } else {
                dialog.showMessageBox(mainWindow, {
                  type: "info",
                  title: "Güncelleme Bulundu",
                  message: "Yeni sürüm indiriliyor.",
                  detail: "İndirme tamamlandığında yeniden başlatma seçeneği sunulacak.",
                  buttons: ["Tamam"],
                });
              }
            } catch {
              dialog.showMessageBox(mainWindow, {
                type: "warning",
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
              icon: ICON_PATH,
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

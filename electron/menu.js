const path = require("path");
const { Menu, dialog, app, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const CH = require("./ipc/channels");
const { runBackup, runRestore } = require("./modules/backup/service");
const { openGuide } = require("./windows/guide");
const ICON_PATH = path.join(__dirname, "../assets/icon.ico");
const SUPPORT_EMAIL = "guray.topagac.dev@gmail.com";

function buildMenu(mainWindow, isDev) {
  const template = [
    {
      label: "Dosya",
      submenu: [
        {
          label: "Veritabanı Yedekle",
          accelerator: "CmdOrCtrl+Shift+B",
          async click() {
            try {
              await runBackup(mainWindow);
            } catch (err) {
              console.error("[Main] Backup failed:", err.message);
            }
          },
        },
        {
          label: "Veritabanı Dosyası Yükle",
          accelerator: "CmdOrCtrl+Shift+R",
          async click() {
            try {
              await runRestore(mainWindow);
            } catch (err) {
              console.error("[Main] Restore failed:", err.message);
            }
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
        ...(isDev ? [{ type: "separator" }, { label: "Yenile", role: "reload" }] : []),
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
                  detail: `Kullandığınız sürüm (${app.getVersion()}) şu an mevcut olan en son sürüm.`,
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
            } catch (err) {
              console.error("[Main] Update check failed:", err.message);
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
          async click() {
            const body = encodeURIComponent(`Sürüm: ${app.getVersion()}\n\nHata açıklaması:\n`);
            try {
              await shell.openExternal(
                `mailto:${SUPPORT_EMAIL}?subject=Mavikent%20Site%20Y%C3%B6netim%20Sistemi%20-%20Hata%20Bildirimi&body=${body}`,
              );
            } catch (err) {
              console.error("[Main] Report bug mailto failed:", err.message);
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
              detail: `Sürüm: ${app.getVersion()}\n\nDestek ve sorularınız için:\n${SUPPORT_EMAIL}`,
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

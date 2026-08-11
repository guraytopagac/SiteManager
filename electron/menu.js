const path = require("path");
const { Menu, dialog, app, shell } = require("electron");
const { runOnDemandUpdateFlow } = require("./autoUpdater");
const { SUPPORT_EMAIL } = require("./errorReporting");
const { CHANNELS: CH } = require("./ipc/channels");
const { runBackup, runRestore } = require("./modules/backup/service");
const { openGuide, toggleGuideTheme } = require("./windows/guide");

const ICON_PATH = path.join(__dirname, "../assets/icon.ico");
const BUG_REPORT_SUBJECT = "Mavikent Site Yönetimi - Hata Bildirimi";

function buildMenu(mainWindow, isDev) {
  const template = [
    {
      label: "Dosya",
      submenu: [
        {
          label: "Yedek Al",
          accelerator: "Ctrl+Shift+B",
          async click() {
            try {
              await runBackup(mainWindow);
            } catch (err) {
              console.error("[Main] Backup failed:", err);
              dialog.showErrorBox("Yedekleme Hatası", "Yedek alınamadı. Lütfen daha sonra tekrar deneyin.");
            }
          },
        },
        {
          label: "Yedekten Geri Yükle",
          accelerator: "Ctrl+Shift+R",
          async click() {
            try {
              await runRestore(mainWindow);
            } catch (err) {
              console.error("[Main] Restore failed:", err);
              dialog.showErrorBox("Geri Yükleme Hatası", "Geri yükleme yapılamadı. Lütfen daha sonra tekrar deneyin.");
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
          accelerator: "Ctrl+Shift+T",
          click() {
            mainWindow.webContents.send(CH.EVENTS.TOGGLE_THEME);
            toggleGuideTheme();
          },
        },
        { type: "separator" },
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Varsayılan Boyut", role: "resetZoom" },
        { type: "separator" },
        { label: "Tam Ekran", role: "togglefullscreen" },
        ...(isDev
          ? [
              { type: "separator" },
              { label: "Yenile", role: "reload" },
              { label: "Geliştirici Araçları", accelerator: "F12", role: "toggleDevTools" },
            ]
          : []),
      ],
    },
    {
      label: "Yardım",
      submenu: [
        {
          label: "Kullanım Kılavuzu",
          accelerator: "F1",
          async click() {
            await openGuide(mainWindow);
          },
        },
        ...(isDev
          ? []
          : [
              { type: "separator" },
              {
                label: "Güncellemeleri Kontrol Et",
                async click() {
                  await runOnDemandUpdateFlow(mainWindow);
                },
              },
            ]),
        { type: "separator" },
        {
          label: "Hata Bildir",
          async click() {
            const subject = encodeURIComponent(BUG_REPORT_SUBJECT);
            const body = encodeURIComponent(`Sürüm: ${app.getVersion()}\n\nHata açıklaması:\n`);
            try {
              await shell.openExternal(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
            } catch (err) {
              console.error("[Main] Report bug mailto failed:", err);
              dialog.showErrorBox(
                "E-posta Uygulaması Açılamadı",
                `Hata bildirimlerinizi doğrudan ${SUPPORT_EMAIL} adresine gönderebilirsiniz.`,
              );
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
              message: "Mavikent Site Yönetimi",
              detail: `Sürüm: ${app.getVersion()}\n\nDestek ve sorularınız için:\n${SUPPORT_EMAIL}`,
              buttons: ["Tamam"],
              icon: ICON_PATH,
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };

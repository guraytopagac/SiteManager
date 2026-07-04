const fs = require("fs");
const path = require("path");
const { app, dialog, clipboard } = require("electron");
const CH = require("../ipc/channels");
const { getSplashWindow } = require("../windows/splash");

async function handleSeedResult(seedResult, mainWindow) {
  if (!seedResult || seedResult.alreadyExists || !mainWindow) return;
  const { username, password, recoveryCode } = seedResult;
  if (!username || !password) {
    console.error("[Main] Admin account created but credentials missing.");
    return;
  }

  const splash = getSplashWindow();
  const parentWindow = splash && !splash.isDestroyed() ? splash : mainWindow;

  const { response } = await dialog.showMessageBox(parentWindow, {
    type: "info",
    title: "İlk Kurulum — Admin Hesabı",
    message: "Admin hesabı oluşturuldu.",
    detail:
      `Kullanıcı adı  : ${username}\n` +
      `Şifre          : ${password}\n` +
      `Kurtarma kodu  : ${recoveryCode}\n\n` +
      `Bu bilgileri not alın — bir daha gösterilmeyecek.\n` +
      `Kurtarma kodu, şifrenizi unutursanız giriş ekranından sıfırlamak için gereklidir.\n` +
      `Giriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.`,
    buttons: ["Bilgileri Kopyala", "Masaüstüne Kaydet", "Tamam"],
    defaultId: 0,
    cancelId: 2,
  });

  if (response === 0) {
    clipboard.writeText(
      `Mavikent Site Yönetimi — Admin Hesabı\nKullanıcı adı: ${username}\nŞifre: ${password}\nKurtarma kodu: ${recoveryCode}`,
    );
    await dialog.showMessageBox(parentWindow, {
      type: "info",
      title: "Kopyalandı",
      message: "Hesap bilgileri panoya kopyalandı.",
      buttons: ["Tamam"],
    });
  } else if (response === 1) {
    const desktopPath = app.getPath("desktop");
    const filePath = path.join(desktopPath, "mavikent-admin-hesabi.txt");
    try {
      fs.writeFileSync(
        filePath,
        `Mavikent Site Yönetimi — Admin Hesabı\n\n` +
          `Kullanıcı adı : ${username}\n` +
          `Şifre         : ${password}\n` +
          `Kurtarma kodu : ${recoveryCode}\n\n` +
          `Kurtarma kodu, şifrenizi unutursanız giriş ekranından sıfırlamak için gereklidir.\n` +
          `Giriş yaptıktan sonra bu dosyayı silin.\n`,
        "utf8",
      );
      await dialog.showMessageBox(parentWindow, {
        type: "info",
        title: "Kaydedildi",
        message: "Hesap bilgileri masaüstüne kaydedildi.",
        detail: `${filePath}\n\n⚠️ Giriş yaptıktan sonra bu dosyayı silmeyi unutmayın.`,
        buttons: ["Tamam"],
      });
    } catch (err) {
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Kayıt Hatası",
        message: "Dosya oluşturulamadı.",
        detail: err.message,
        buttons: ["Tamam"],
      });
    }
  }

  mainWindow.webContents.send(CH.EVENTS.PREFILL_LOGIN, { username, password });
}

module.exports = { handleSeedResult };

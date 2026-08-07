const { app, dialog, shell } = require("electron");
const log = require("electron-log");

const SUPPORT_EMAIL = "guray.topagac.dev@gmail.com";
const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024;

let getParentWindow = () => null;
let fatalErrorShown = false;

function showFatalError(title, message, whatToDo, parentWindow) {
  const logFilePath = log.transports.file.getFile().path;

  if (!app.isReady()) {
    dialog.showErrorBox(
      title,
      `${message}\n\n${whatToDo}\n\nSorun sürerse şu dosyayı ${SUPPORT_EMAIL} adresine gönderin:\n${logFilePath}`,
    );
    return;
  }

  const options = {
    type: "error",
    title,
    message,
    detail: `${whatToDo}\n\nSorun sürerse "Kayıt Dosyasını Göster" butonuna basın ve açılan dosyayı ${SUPPORT_EMAIL} adresine gönderin.`,
    buttons: ["Kayıt Dosyasını Göster", "Kapat"],
    defaultId: 1,
    cancelId: 1,
  };

  const choice =
    parentWindow && !parentWindow.isDestroyed()
      ? dialog.showMessageBoxSync(parentWindow, options)
      : dialog.showMessageBoxSync(options);

  if (choice === 0) shell.showItemInFolder(logFilePath);
}

function catchRendererConsole() {
  app.on("web-contents-created", (event, webContents) => {
    webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
      if (level !== "error" && level !== "warning") return;

      const line = `[Renderer] ${message} (${sourceId}:${lineNumber})`;
      if (level === "error") console.error(line);
      else console.warn(line);
    });
  });
}

function initLogging(parentWindowResolver) {
  if (parentWindowResolver) getParentWindow = parentWindowResolver;

  log.initialize({ preload: false });
  log.transports.file.maxSize = LOG_FILE_MAX_SIZE;
  Object.assign(console, log.functions);

  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error, errorName }) => {
      console.error(errorName, error);

      if (errorName.includes("rejection") || fatalErrorShown) return false;

      fatalErrorShown = true;
      showFatalError(
        "Beklenmeyen Hata",
        "Uygulamada beklenmeyen bir hata oluştu.",
        "Uygulamayı kapatıp yeniden açın. Verileriniz etkilenmedi.",
        getParentWindow(),
      );
      return false;
    },
  });

  catchRendererConsole();

  console.warn(`[Main] Starting v${app.getVersion()} (${app.isPackaged ? "packaged" : "dev"})`);
}

module.exports = { initLogging, showFatalError, SUPPORT_EMAIL };

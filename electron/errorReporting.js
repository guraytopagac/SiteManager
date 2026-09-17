// Sets up main-process logging and holds the one fatal error box.
const { app, dialog, shell } = require("electron");
const log = require("electron-log");

const SUPPORT_EMAIL = "guray.topagac.dev@gmail.com";
const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024;

// main.js passes this in. Importing windows/main here would create a require cycle.
let getParentWindow;
let fatalErrorShown = false;

function showFatalError(title, message, whatToDo, parentWindow) {
  // getFile() only builds the path, it does not create the file.
  const logFilePath = log.transports.file.getFile().path;

  // A box with buttons does not work before ready, so this path uses showErrorBox.
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

  // Tied to the main window when there is one, or Windows can hide it behind the app.
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
  getParentWindow = parentWindowResolver;

  // preload: false because no renderer imports electron-log. The default would add a dead preload.
  log.initialize({ preload: false });
  log.transports.file.maxSize = LOG_FILE_MAX_SIZE;
  // Sends main-process console.* to main.log. Must come after the electron-log require, or it loops.
  Object.assign(console, log.functions);

  // showDialog: false, because the package box is English and shows a raw stack trace.
  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error, errorName }) => {
      // Logged here and false is returned, so the error reaches the file before the box opens.
      console.error(errorName, error);

      // Rejections stay silent, and the box opens at most once while the app runs.
      if (errorName.includes("rejection") || fatalErrorShown) return false;

      fatalErrorShown = true;
      showFatalError(
        "Beklenmeyen Hata",
        "Uygulamada beklenmeyen bir hata oluştu.",
        "Uygulamayı kapatıp yeniden açın. Verileriniz etkilenmedi.",
        getParentWindow?.(),
      );
      return false;
    },
  });

  catchRendererConsole();

  // Also makes sure the log file exists.
  console.warn(`[Main] Starting v${app.getVersion()} (${app.isPackaged ? "packaged" : "dev"})`);
}

module.exports = { initLogging, showFatalError, SUPPORT_EMAIL };

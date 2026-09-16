// Report IPC entry points. One returns the report data, the other prints the report page to a PDF.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, dialog } = require("electron");
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { getMainWindow } = require("../../windows/main");
const {
  fail,
  isValidFileName,
  isValidYear,
  validateBuildingScope,
  validatePayload,
  validatePeriod,
} = require("../shared/validate");
const { currentPeriod, toPeriod } = require("../shared/trTime");
const reportService = require("./service");

const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönem için rapor alınamaz.";

// Kept in step with the renderer's own list, see the enum parity rule in the docs.
const REPORT_SCOPES = ["month", "year", "all"];

// The scope decides which period fields the payload has to carry. A year is future when its
// January has not arrived yet, so the running year is still a valid report.
function validateReportScope(payload) {
  const { scope } = payload;

  if (!REPORT_SCOPES.includes(scope)) {
    return fail("Geçersiz rapor türü.");
  }
  if (scope === "month") {
    return validatePeriod(payload, FUTURE_PERIOD_MESSAGE);
  }
  if (scope === "year") {
    if (!isValidYear(payload.year)) {
      return fail("Geçersiz tarih bilgisi.");
    }
    if (toPeriod(payload.year, 1) > currentPeriod()) {
      return fail(FUTURE_PERIOD_MESSAGE);
    }
  }

  return null;
}

// An in-memory session of its own, so the request filter set on it reaches no other window.
const PRINT_PARTITION = "report-print";

// Only a guard against a broken caller filling the temp folder. A real report is far below it.
const MAX_REPORT_HTML_LENGTH = 20 * 1024 * 1024;

// The save box names the document being saved. The renderer sends one of these keys, never the
// title itself, and a missing key means a report.
const SAVE_DIALOG_TITLES = {
  report: "Raporu Kaydet",
  receipt: "Makbuzu Kaydet",
  voucher: "Gider Pusulasını Kaydet",
};

// The renderer builds the whole page, CSS included, and sends it here as a string.
function validateSaveFileFields(payload) {
  const { filename, html, documentType } = payload;
  if (!isValidFileName(filename)) {
    return fail("Geçersiz dosya adı.");
  }
  if (documentType != null && !Object.hasOwn(SAVE_DIALOG_TITLES, documentType)) {
    return fail("Geçersiz belge türü.");
  }
  if (typeof html !== "string" || html.length === 0 || html.length > MAX_REPORT_HTML_LENGTH) {
    return fail("Geçersiz rapor içeriği.");
  }
  return null;
}

// The page is markup from the renderer, so it is printed with scripts off and every request other
// than the page itself is cancelled. It goes through a temp file because Chromium caps a URL at
// 2 MB, and a data URL of a large ledger can pass that. Paper size, margins and the page footer
// all come from the page's own CSS.
async function printReportPdf(html) {
  const pagePath = path.join(app.getPath("temp"), `mavikent-rapor-${Date.now()}.html`);
  const pageUrl = pathToFileURL(pagePath).href;
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { partition: PRINT_PARTITION, sandbox: true, javascript: false },
  });
  printWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: details.url !== pageUrl });
  });

  try {
    await fs.promises.writeFile(pagePath, html, "utf8");
    await printWindow.loadURL(pageUrl);
    return await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  } finally {
    printWindow.destroy();
    await fs.promises.rm(pagePath, { force: true });
  }
}

// The only body that stays in a handler, because it never touches the database. The save box is
// tied to the main window, or Windows can hide it behind the app. It is asked first, so a cancel
// never opens the print window.
async function saveReportFile(payload) {
  const { filename, html, documentType = "report" } = payload;
  const { filePath, canceled } = await dialog.showSaveDialog(getMainWindow(), {
    title: SAVE_DIALOG_TITLES[documentType],
    defaultPath: filename,
    filters: [{ name: "PDF Dosyası", extensions: ["pdf"] }],
  });

  // Cancelling is not an error. The caller reads the cancelled field, not the message.
  if (canceled || !filePath) return { success: false, cancelled: true, message: "İptal edildi." };

  const pdf = await printReportPdf(html);
  await fs.promises.writeFile(filePath, pdf);
  return { success: true, message: filePath };
}

function registerReportHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "report");

  handle(
    CH.REPORT.GET_DATA,
    (payload) => validateBuildingScope(payload) ?? validateReportScope(payload),
    reportService.getReportData,
  );
  handle(
    CH.REPORT.SAVE_FILE,
    (payload) => validatePayload(payload) ?? validateSaveFileFields(payload),
    saveReportFile,
    "Dosya kaydedilemedi.",
  );
}

module.exports = registerReportHandlers;

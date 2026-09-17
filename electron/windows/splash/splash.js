// Splash renderer. It has splashAPI and nothing else, and no access to Node.
const versionEl = document.getElementById("version");
const statusEl = document.getElementById("status");
const statusTextEl = document.getElementById("status-text");
const statusDotsEl = document.getElementById("status-dots");
const updateBadge = document.getElementById("update-badge");
const updateBadgeText = document.getElementById("update-badge-text");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressPercent = document.getElementById("progress-percent");
const progressStatus = document.getElementById("progress-status");
const progressSize = document.getElementById("progress-size");
const restartPrompt = document.getElementById("restart-prompt");
const restartNowBtn = document.getElementById("restart-now");
const restartLaterBtn = document.getElementById("restart-later");

// Kept, so the status can go back to it while there is no download speed yet.
const DEFAULT_PROGRESS_STATUS = progressStatus.textContent;
const currentVersion = new URLSearchParams(window.location.search).get("v") || "";

versionEl.textContent = currentVersion ? "v" + currentVersion : "v—";

function formatMB(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return Math.ceil(seconds) + " sn kaldı";
  return Math.ceil(seconds / 60) + " dk kaldı";
}

// splashAPI is missing only if the preload failed. The splash then stays as it is.
if (window.splashAPI) {
  window.splashAPI.onStatus(({ text, isError }) => {
    statusEl.classList.toggle("splash-status-error", Boolean(isError));
    statusDotsEl.classList.toggle("splash-hidden", Boolean(isError));
    statusTextEl.textContent = text;
  });

  window.splashAPI.onUpdateAvailable(({ version }) => {
    updateBadgeText.textContent = currentVersion ? "v" + currentVersion + " → v" + version : "v" + version;
    updateBadge.classList.add("splash-visible");
    statusEl.classList.add("splash-hidden");
    progressWrap.classList.add("splash-visible");
  });

  window.splashAPI.onDownloadProgress(({ percent, transferred, total, bytesPerSecond }) => {
    progressFill.style.width = percent + "%";
    progressPercent.textContent = "%" + percent;
    progressSize.textContent = total > 0 ? formatMB(transferred) + " / " + formatMB(total) : "";

    const remainingBytes = total - transferred;
    const eta = bytesPerSecond > 0 ? formatEta(remainingBytes / bytesPerSecond) : "";
    progressStatus.textContent = eta ? "( İndiriliyor " + eta + " )" : DEFAULT_PROGRESS_STATUS;
  });

  window.splashAPI.onUpdateDownloaded(() => {
    progressFill.style.width = "100%";
    progressPercent.textContent = "%100";
    progressStatus.textContent = "( Güncelleme hazır )";
    restartPrompt.classList.add("splash-visible");
    restartNowBtn.focus();
  });

  // The choice is sent once. If the window is closed instead, the main process reads that as a no.
  let choiceSent = false;
  const sendChoice = (restart) => {
    if (choiceSent) return;
    choiceSent = true;
    restartNowBtn.disabled = true;
    restartLaterBtn.disabled = true;
    window.splashAPI.sendRestartChoice(restart);
  };

  restartNowBtn.addEventListener("click", () => sendChoice(true));
  restartLaterBtn.addEventListener("click", () => sendChoice(false));

  // The fade out. Its length must match CLOSE_FADE_MS in the splash window module.
  window.splashAPI.onClosing(() => {
    document.body.classList.add("splash-closing");
  });
}

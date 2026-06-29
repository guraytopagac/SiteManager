const versionEl = document.getElementById("version");
const statusEl = document.getElementById("status");
const updateBadge = document.getElementById("update-badge");
const updateBadgeText = document.getElementById("update-badge-text");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressPercent = document.getElementById("progress-percent");
const progressSize = document.getElementById("progress-size");

function formatMB(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

if (window.splashAPI) {
  window.splashAPI.onVersion(({ version }) => {
    versionEl.textContent = "v" + version;
  });

  window.splashAPI.onStatus(({ text }) => {
    statusEl.innerHTML =
      text + '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
  });

  window.splashAPI.onUpdateAvailable(({ version }) => {
    updateBadgeText.textContent = "v" + version + " İndiriliyor";
    updateBadge.classList.add("visible");
    statusEl.innerHTML =
      "Güncelleme indiriliyor" +
      '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
    progressWrap.classList.add("visible");
  });

  window.splashAPI.onDownloadProgress(({ percent, transferred, total }) => {
    progressFill.style.width = percent + "%";
    progressPercent.textContent = "%" + percent;
    progressSize.textContent = total > 0 ? formatMB(transferred) + " / " + formatMB(total) : "";
  });

  window.splashAPI.onUpdateDownloaded(() => {
    progressFill.style.width = "100%";
    progressPercent.textContent = "%100";
    progressSize.textContent = "";
    statusEl.textContent = "Güncelleme hazır";
    updateBadgeText.textContent = "İndirme Tamamlandı";
  });

  window.splashAPI.ready();
}

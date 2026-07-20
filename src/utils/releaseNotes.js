import { formatDate } from "./date.js";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
  {
    version: "1.5.0",
    date: "2026-07-20",
    title: "Şifre kurtarma ekranı ve giriş güvenliği",
    changes: [
      "Şifrenizi unuttuysanız artık ayrı bir kurtarma ekranından iki adımda sıfırlayabilirsiniz.",
      "Yeni şifrenizi girerken tekrar alanı, göster/gizle düğmesi ve güç göstergesi eşlik ediyor.",
      "Şifre alanlarında Caps Lock açıkken uyarı beliriyor.",
      "Giriş, kurulum ve kurtarma ekranları yenilendi; yazılar büyütülerek okunabilirlik artırıldı.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-07-18",
    title: "Sürüm notları penceresi ve arayüz iyileştirmeleri",
    changes: [
      "Alt bardan sürüm notlarına ulaşabilir, yeni sürümde gelen değişiklikleri görebilirsiniz.",
      "Kurulum ekranı açık temada yenilendi; şifre kuralları artık bekleyen ve hatalı durumu ayrı gösteriyor.",
      "Giriş yapmışken giriş ekranına geri dönülmesi engellendi.",
      "Küçük ekranlarda uygulama penceresi ekrana sığacak şekilde açılıyor.",
      "Tarih ve saat gösterimi ile uyarı pencerelerinde iyileştirmeler yapıldı.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-14",
    title: "Türkiye saat dilimi ve arayüz yenileme",
    changes: [
      "Tüm zaman damgaları Türkiye saatine (UTC+3) göre kaydediliyor.",
      "Daireler sayfası görüntüleme ve yönetim olarak ikiye ayrıldı.",
      "Genel arayüz ve okunabilirlik iyileştirmeleri.",
    ],
  },
];

const renderRelease = (release, currentVersion) => `
      <section class="release-note${release.version === currentVersion ? " release-note-current" : ""}">
        <h3 class="release-note-version">
          <span>
            v${release.version}: ${release.title}
            ${release.version === currentVersion ? '<span class="release-note-badge">Şu anki sürüm</span>' : ""}
          </span>
          ${release.date ? `<time class="release-note-date" datetime="${release.date}">${formatDate(release.date)}</time>` : ""}
        </h3>
        <ul class="release-note-list">
          ${release.changes.map((change) => `<li>${change}</li>`).join("")}
        </ul>
      </section>`;

export const renderReleaseNotesHtml = (currentVersion) =>
  `<div class="release-notes">${RELEASE_NOTES.map((release) => renderRelease(release, currentVersion)).join("")}</div>`;

export const hasUnseenReleaseNotes = (version) =>
  Boolean(version) && localStorage.getItem(RELEASE_NOTES_SEEN_KEY) !== version;

export const markReleaseNotesSeen = (version) => {
  if (version) localStorage.setItem(RELEASE_NOTES_SEEN_KEY, version);
};

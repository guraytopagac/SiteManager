// Release notes for the footer dialog. Only the last three releases stay in the list: a new entry goes to the
// front and the oldest one is deleted. Each version string must match package.json.

import { formatDate } from "./date";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
  {
    version: "2.0.3",
    date: "2026-09-19",
    title: "Nakit ve banka hesapları, personel avansı",
    changes: [
      "Ana kasa Nakit ve Banka olarak ikiye ayrıldı. Gelirin hesabı ödeme şeklinden belirleniyor, giderde ödeme tipi soruluyor.",
      "Nakit ile banka arasında aktarım yapılabiliyor. Aktarım gelir ya da gider sayılmıyor ve gerektiğinde iptal edilebiliyor.",
      "Personel avansı eklendi. Çalışana verilen avans gider, geri ödemesi avans iadesi olarak kaydediliyor ve açık avans çalışan listesinde görünüyor.",
      "Gelir ve Gider sayfasının adı Kasa Defteri, Tazminat Kasası sayfasının adı Personel oldu. Panodaki işlemler iki grupta toplandı.",
      "Aidat makbuzu tahsilat penceresinden de oluşturulabiliyor.",
      "Rapor PDF'inin kasa özeti dönem sonundaki nakit ve banka tutarlarını gösteriyor.",
    ],
  },
  {
    version: "2.0.2",
    date: "2026-09-18",
    title: "Elle tazminat aktarımı ve genişleyen kategoriler",
    changes: [
      "Tazminat kasasına aktarım artık otomatik yapılmıyor. Aktarım, Gelir ve Gider sayfasından Tazminat Aktarımı kategorisiyle istenen zamanda ve istenen tutarda giriliyor.",
      "Elle girilen tazminat aktarımı Gelir ve Gider sayfasından iptal edilebiliyor.",
      "Tazminat Kasası sayfası sadeleştirildi. Özet şeridinde kasa bakiyesi ve tahmini yükümlülük yer alıyor, çalışan detayları ayrı bir pencerede gösteriliyor.",
      "Gider kategorileri genişletildi. Elektrik, su, asansör, personel sigortası, bina sigortası, banka masrafı gibi kalemler eklendi. Gelir tarafına faiz geliri eklendi.",
      "Kayıt penceresinde kategori listesi sürekli açık duruyor ve kategori seçimi zorunlu oldu.",
      "Tazminat kasası ölçümü panodan kaldırıldı.",
    ],
  },
  {
    version: "2.0.1",
    date: "2026-09-17",
    title: "Tazminat kasası",
    changes: [
      "Tazminat Kasası sayfası eklendi. Kapıcı, bahçıvan ve güvenlik gibi bina çalışanlarının kıdem tazminatı için ayrılan para takip edilebiliyor.",
      "Belirlenen aylık tutar her ay ana kasadan tazminat kasasına gider olarak aktarılıyor. Kasa açılış bakiyesiyle başlatılabiliyor.",
      "Çalışanlar işe giriş tarihi ve brüt ücretiyle kaydediliyor, her çalışan için tahmini tazminat hesaplanıyor.",
      "Tazminat ödemesi kasadan yapılıyor. Kasa yetmezse eksik tutar ana kasadan ekleniyor, ödeme gerektiğinde iptal edilebiliyor.",
      "Pano, Gelir ve Gider sayfası ve raporlar tazminat kasasını gösteriyor.",
      "Uygulama kaldırıldığında bu bilgisayardaki uygulama verisi de siliniyor. Verilerin korunması için kaldırmadan önce yedek alınmalıdır.",
    ],
  },
];

// The release-note-* classes live in global.css, because the owner of a style is the module that builds the
// markup, not the component that opens the dialog.
const renderRelease = (release, currentVersion) => {
  const isCurrent = release.version === currentVersion;
  return `
      <section class="release-note">
        <h3 class="release-note-version">
          <span>
            v${release.version}: ${release.title}
            ${isCurrent ? '<span class="release-note-badge">Şu anki sürüm</span>' : ""}
          </span>
          <time class="release-note-date" datetime="${release.date}">${formatDate(release.date)}</time>
        </h3>
        <ul class="release-note-list">
          ${release.changes.map((change) => `<li>${change}</li>`).join("")}
        </ul>
      </section>`;
};

export const renderReleaseNotesHtml = (currentVersion) =>
  `<div class="release-notes">${RELEASE_NOTES.map((release) => renderRelease(release, currentVersion)).join("")}</div>`;

// The running version has to exist in the list, so a build whose notes were not written yet never opens the
// dialog on its own.
export const hasUnseenReleaseNotes = (version) =>
  RELEASE_NOTES.some((release) => release.version === version) &&
  localStorage.getItem(RELEASE_NOTES_SEEN_KEY) !== version;

export const markReleaseNotesSeen = (version) => localStorage.setItem(RELEASE_NOTES_SEEN_KEY, version);

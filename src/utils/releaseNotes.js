import { formatDate } from "./date";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
  {
    version: "1.7.0",
    date: "2026-09-04",
    title: "Yenilenen pano, kişi sayısı ve ortak oturum ekranları",
    changes: [
      'Sakin kaydına "Dairede Yaşayan Kişi Sayısı" alanı eklendi. Bina listesindeki kişi sayısı artık bu değerden toplanıyor.',
      "Pano yeniden tasarlandı. Kasa, tahsilat ve gecikme tek bir yüzeyde toplandı, üçüne de tıklayarak ilgili listeye geçebilirsiniz.",
      "Panodaki ölçülemeyen durumlar artık sıfır yerine açıklamayla gösteriliyor. Defter tamamen boşken pano doğrudan daire eklemeye yönlendiriyor.",
      "Giriş, kurulum, şifre kurtarma ve bina seçim ekranları ortak bir görsel dile alındı.",
      "Bina seçim kartları yenilendi. Daire ve kişi sayısı satırda görünüyor, yeniden adlandırma ve silme düğmeleri her zaman açıkta duruyor.",
      'Kurulum ve şifre kurtarma ekranlarındaki "Kodu Kopyala" düğmesi artık kopyalandığını bildiriyor.',
    ],
  },
  {
    version: "1.6.0",
    date: "2026-08-03",
    title: "Tek hesap, çoklu bina ve aidat tahakkuku",
    changes: [
      "Tek hesapla birden fazla bina yönetebilirsiniz. Giriş sonrası bina seçilir, tek bina varsa doğrudan panoya geçilir.",
      "Binalar seçim ekranından yeniden adlandırılır, arşivlenir ve gerektiğinde kalıcı olarak silinir.",
      "Aidatlar artık ödeme beklemeden her ay tahakkuk ediyor. Ödenmemiş geçmiş aylar da listede ve raporlarda görünüyor.",
      "Yönetici ve site yöneticisi ayrımı kaldırıldı. Şifre değiştirme, kurtarma kodu ve hesap devri Profil sayfasında toplandı.",
      "Yedek alma uygulama içine taşındı. Profil sayfasındaki düğmeyle menüye gitmeden yedek alabilirsiniz.",
      "Daireler ve aidat tek sayfada birleştirildi. Tahsilat satırdaki düğmeyle tek adımda yapılıyor.",
      "Sağ üstteki hesap menüsü ile Profil, bina değiştirme ve çıkış her sayfadan erişilebilir.",
      "Para tutarları uygulamanın tamamında kuruşlu tek biçimde gösteriliyor.",
    ],
  },
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
];

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

export const hasUnseenReleaseNotes = (version) =>
  RELEASE_NOTES.some((release) => release.version === version) &&
  localStorage.getItem(RELEASE_NOTES_SEEN_KEY) !== version;

export const markReleaseNotesSeen = (version) => localStorage.setItem(RELEASE_NOTES_SEEN_KEY, version);

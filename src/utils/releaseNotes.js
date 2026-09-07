import { formatDate } from "./date";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
  {
    version: "1.8.0",
    date: "2026-09-08",
    title: "Bina kurulum sihirbazı, dekontlu tahsilat ve yenilenen daire listesi",
    changes: [
      "Yeni bina oluşturma iki adımlı bir sihirbaza taşındı. İkinci adımda kat ve daire düzeninin önizlemesi görünüyor, bina daireleriyle birlikte tek adımda kuruluyor.",
      "Daireler ve Aidat sayfası yeniden tasarlandı. Durum süzgeçleri, daire ve sakin araması, sayfalama ve tahsilat özeti eklendi.",
      "Aidat tahsilatına dekont eklenebiliyor. PDF, JPG, PNG ve WEBP dosyaları 5 MB'a kadar kabul ediliyor, dekont sonradan da eklenip değiştirilebiliyor ve varsayılan uygulamada açılıyor.",
      'Ödeme kaydına "Tahsil Eden" alanı eklendi. Aidatı başkası topladığında ödeme geçmişinde o kişinin adı görünüyor.',
      "Silinen dairenin numarası yeniden kullanılabiliyor. Aynı numarayla eklenen daire artık silinen dairenin aidat ve sakin geçmişini devralmıyor.",
      "Daireler ve İşlemler sayfaları ortak bir dönem seçicisi kullanıyor.",
      "Tahsilat, daire düzenleme, toplu aidat ve sakin pencereleri ortak bir görsel dile alındı.",
    ],
  },
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

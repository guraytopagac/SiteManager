// Release notes for the footer modal. Only the last three releases stay in the list: a new entry goes to the
// front and the oldest one is deleted. Each version string must match package.json.

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

export const RELEASE_NOTES = [
  {
    version: "2.1.0",
    date: "2026-09-22",
    title: "Yatırım aidatı",
    changes: [
      "Yatırım Aidatı sayfası eklendi. Çatı, asansör, mantolama gibi büyük işler için aylık aidatın üstüne toplanan katkı daire bazında takip ediliyor.",
      "Yatırım katkısının muhatabı dairenin malikidir. Liste, tahsilat penceresi ve makbuz o dönemin malikini gösteriyor.",
      "Toplanan para ana kasaya giriyor. Fondan yapılan harcama gider kaydında Yatırım fonundan işaretiyle ayrılıyor ve fon bakiyesinden düşüyor.",
      "Fonun aylık tutarı değiştirilebiliyor, toplama istenildiği zaman durdurulup yeniden başlatılabiliyor.",
      "Rapor PDF'ine Yatırım Fonu bölümü eklendi. Dönem başı bakiye, fona giren, fondan harcanan ve dönem sonu bakiye gösteriliyor.",
      "Profil sayfasının şifre değiştirme, kurtarma kodu, e-posta ve hesap devri işlemleri kendi pencerelerine taşındı.",
      "Uygulama içindeki bilgi ve onay kutuları yenilendi. Başarı bildirimleri artık kutu yerine kısa süreli bildirim olarak gösteriliyor.",
    ],
  },
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
];

// The running version has to exist in the list, so a build whose notes were not written yet never marks the
// version button on its own.
export const hasUnseenReleaseNotes = (version) =>
  RELEASE_NOTES.some((release) => release.version === version) &&
  localStorage.getItem(RELEASE_NOTES_SEEN_KEY) !== version;

export const markReleaseNotesSeen = (version) => localStorage.setItem(RELEASE_NOTES_SEEN_KEY, version);

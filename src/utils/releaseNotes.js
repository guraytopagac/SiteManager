// Release notes for the footer modal. Only the last three releases stay in the list: a new entry goes to the
// front and the oldest one is deleted. Each version string must match package.json.

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

export const RELEASE_NOTES = [
  {
    version: "2.3.0",
    date: "2026-09-24",
    title: "Peşin aidat ve yönetim dönemleri",
    changes: [
      "Peşin aidat eklendi. Aidat, bu ay dahil 12 aya kadar peşin tahsil edilebiliyor. Başlangıç ve bitiş ayı seçiliyor, gerektiğinde peşin ödeme iade edilebiliyor.",
      "Profilim sayfasında Yönetim Dönemleri listesi yer alıyor. Hesabı kimin ne zaman tuttuğu görünüyor, devirden önceki kayıtlar önceki yöneticinin adıyla gösteriliyor.",
      "Aidat Takibi'nde birden fazla dairenin aidatı tek işlemde güncellenebiliyor.",
      "Pano yenilendi. Ölçümler ayrı kartlarda gösteriliyor, sayfalara giden kartlar iki grupta ve kullanım sıklığına göre sıralanıyor.",
      "Bina seçimi ekranı sayfalara bölündü. Silinen binalar ayrı bir pencerede listeleniyor.",
      "Yeni bina sihirbazında bina önizlemesi iki adımda da görünüyor.",
      "Zemin katlı binada en üst katın girilen kat sayısından bir eksik oluşturulması düzeltildi.",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-09-23",
    title: "Excel çıktısı ve yenilenen rapor PDF'i",
    changes: [
      "Raporlar Excel dosyası olarak da indirilebiliyor. Dışa Aktar menüsünde her dönem için PDF ve Excel seçenekleri yer alıyor.",
      "Excel dosyasında özet, dağılım, hareketler, banka hareketleri ve aidat durumu ayrı sayfalarda yer alıyor. Tablolar süzülüp sıralanabiliyor.",
      "Rapor PDF'ine Banka Hareketleri bölümü eklendi. Banka hesabına giren ve çıkan kayıtlar ile hesaplar arası aktarımlar tek tabloda listeleniyor.",
      "Uzun dönemli raporlarda hareket tabloları ay ay ayrılıyor. Uzun tablolar yeni sayfada başlıyor.",
      "Harfle başlayan daire numaraları doğru sırada listeleniyor. A10 artık A8'in önüne düşmüyor.",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-09-22",
    title: "Yatırım aidatı",
    changes: [
      "Yatırım Aidatı sayfası eklendi. Çatı, asansör, mantolama gibi büyük işler için aylık aidatın üstüne toplanan katkı daire bazında takip ediliyor.",
      "Yatırım katkısının muhatabı dairenin malikidir. Liste, tahsilat penceresi ve makbuz o dönemin malikini gösteriyor.",
      "Toplanan para ana kasaya giriyor. Fondan yapılan harcama gider kaydında Yatırım fonundan işaretiyle ayrılıyor ve fon bakiyesinden düşüyor.",
      "Fonun aylık tutarı değiştirilebiliyor, toplama istenildiği zaman durdurulup yeniden başlatılabiliyor.",
      "Rapor PDF'ine Yatırım Aidatı bölümü eklendi. Dönem başı bakiye, fona giren, fondan harcanan ve dönem sonu bakiye gösteriliyor.",
      "Profil sayfasının şifre değiştirme, kurtarma kodu, e-posta ve hesap devri işlemleri kendi pencerelerine taşındı.",
      "Uygulama içindeki bilgi ve onay kutuları yenilendi. Başarı bildirimleri artık kutu yerine kısa süreli bildirim olarak gösteriliyor.",
    ],
  },
];

// The running version has to exist in the list, so a build whose notes were not written yet never marks the
// version button on its own.
export const hasUnseenReleaseNotes = (version) =>
  RELEASE_NOTES.some((release) => release.version === version) &&
  localStorage.getItem(RELEASE_NOTES_SEEN_KEY) !== version;

export const markReleaseNotesSeen = (version) => localStorage.setItem(RELEASE_NOTES_SEEN_KEY, version);

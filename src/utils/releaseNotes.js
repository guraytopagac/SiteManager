import { formatDate } from "./date";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
  {
    version: "2.0.0",
    date: "2026-09-16",
    title: "Tahsilat makbuzu, gider pusulası ve yenilenen raporlar",
    changes: [
      "Tahsilat makbuzu ve gider pusulası eklendi. Gelir ve gider kaydının detayından PDF belge oluşturulup bilgisayara kaydedilebiliyor.",
      "Belge oluşturulurken ödeyen, hizmeti veren ve adres bilgileri girilebiliyor. Belgeye basılacak bilgilerin tamamı kaydetmeden önce listeleniyor ve tutar yazıyla da yazılıyor.",
      "Aidat makbuzu dairenin o ayının tamamını kapsıyor. Ay içinde farklı yöntemlerle alınan tahsilatlar tek makbuzda toplanıyor.",
      "Raporlar sayfası yeniden tasarlandı. Dönem toplamları, aidat tahsilatı ve gelir gider dağılımı ekranda özet olarak görünüyor.",
      "Rapor kapsamı aylık, yıllık ve tüm zamanlar olarak seçiliyor ve dönem ok tuşlarıyla adımlanıyor. İndirme menüsü üç raporu birden sunuyor.",
      "Rapor PDF'i yeniden yazıldı. Devreden kasa, yıllık raporda aylık döküm, sayfa altbilgisi ve imza alanı eklendi.",
      "Profil sayfası yeniden tasarlandı. Şifre değiştirme ve hesap devri kendi pencerelerine taşındı.",
      "Hesap devri artık bir devir dosyası oluşturuyor. Yeni yönetici başka bir bilgisayarda bu dosyayı kurulum ekranından yükleyerek kaldığı yerden devam edebiliyor.",
      "Kurulum ekranına dosyadan yükleme bağlantısı eklendi. Bilgisayar değiştiren yönetici yedeğini buradan geri yükleyebiliyor.",
      "Gelir kaydına ödeme şekli eklendi. Gelir kategorileri gözden geçirildi, su ve ısı payı eklendi.",
      "Gelir ve gider açıklaması isteğe bağlı oldu.",
      "Kişi adları kaydedilirken Türkçe yazım kurallarıyla biçimleniyor.",
      "Dönem seçicilerindeki yıl listesi hesabın açıldığı yıldan başlıyor.",
      "Sayfalar verisi hazır olmadan boş çizilmiyor. Dönem değiştirildiğinde ve kayıt sonrasında listeler yerinde yenileniyor.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-09-11",
    title: "Malik ve kiracı kayıtları, bina görünümü ve yenilenen gelir gider sayfası",
    changes: [
      "Sakinler sayfası yeniden tasarlandı. Daire listesine doluluk süzgeçleri, arama ve dönem seçicisi eklendi, seçilen dairenin bilgileri sağdaki panelde görünüyor.",
      "Bir dairede malik ve kiracı kaydı birlikte tutulabiliyor. Dairede fiilen kimin oturduğu ayrıca işaretleniyor, yalnızca iletişim için girilmiş malik daireyi dolu göstermiyor.",
      "Kiracı çıkışı ve malik devri tek adımda yapılıyor. Yerine gelen kişi aynı pencerede kaydediliyor, ileri tarihli devir planlanabiliyor, planlanan devir düzenlenebiliyor ya da iptal edilebiliyor.",
      "Geçmiş bir ay görüntülendiğinde o ayda dairede kim oturuyorduysa o kişi gösteriliyor. Aidat listesi, sakin listesi ve raporlar aynı kurala uyuyor.",
      "Sakin geçmişi yenilendi. Kayıtlar tarih sırasıyla listeleniyor ve karta tıklandığında o kişinin iletişim bilgileri açılıyor.",
      "Telefon numarası yazılırken otomatik gruplanıyor. Dairede yaşayan kişi sayısı isteğe bağlı oldu ve bilinmiyorsa boş bırakılabiliyor.",
      "Bina Görünümü sayfası eklendi. Daireler bina cephesi olarak çiziliyor, daire ekleme, düzenleme ve silme bu sayfada toplandı.",
      "Aidat Takibi yenilendi. Daire aidatı tek tek ya da toplu güncelleniyor ve değişikliğin hangi aydan geçerli olacağı soruluyor.",
      "Gelir ve gider işlemleri tek sayfada birleşti. Kayıt girişi pencereye taşındı, tür süzgeci, arama, sayfalama ve dönem net özeti eklendi.",
      "İptal edilen gelir ve gider kayıtları listede işaretleniyor. Detay düğmesi iptal nedenini ve iptal tarihini gösteriyor.",
      "Kayıt bulunmayan geçmiş aylarda listeler artık kayıtların başladığı aya yönlendiriyor.",
    ],
  },
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

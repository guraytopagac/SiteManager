// Release notes for the footer dialog. Only the last three releases stay in the list: a new entry goes to the
// front and the oldest one is deleted. Each version string must match package.json.

import { formatDate } from "./date";

const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

const RELEASE_NOTES = [
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

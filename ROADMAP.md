# Mavikent Site Yönetimi — Geliştirme Roadmap'i

Bu dosya geliştirme planını, teknik borç analizini ve gelecek fikirlerini içerir.
Mevcut durum ve mimari için bkz. `CLAUDE.md`.

> **Kurallar:**
> - Bir görev tamamlandığında ilgili bölüm bu dosyadan **silinir**; davranış değiştiyse `CLAUDE.md` güncellenir.
> - Zorluk skalası: 🟢 kolay (< yarım gün) · 🟡 orta (1–2 gün) · 🔴 zor (3+ gün / mimari karar)
> - Faz sırası önem/bağımlılık sırasıdır — üstteki bitmeden alttakine geçme (aynı faz içindekiler paralel yapılabilir).

---

## Genel Bakış — 8 Haftalık Plan

| Faz | Hafta | Tema | Görevler |
| --- | ----- | ---- | -------- |
| 1 | 1 | Güvenlik ve sağlamlaştırma | G1 yetki düzeltmesi, G2 ESLint sıkılaştırma, G3 test kapsamı |
| 2 | 2–3 | Kullanıcıya görünür hızlı kazanımlar | Ö1 aidat hatırlatma, Ö3 gelişmiş filtreler |
| 3 | 4–5 | Raporlama ve veri çıkışı | Ö4 PDF makbuz, Ö5 CSV/Excel dışa aktarım, Ö6 dashboard trend grafiği |
| 4 | 6–7 | Veri güvenliği altyapısı | A1 otomatik yedekleme, A2 yedek klasörü senkronu |
| 5 | 8+ | Ölçek ve refactor | T2 sayfalama, (karar sonrası) çok bina desteği |

---

## Faz 1 — Güvenlik ve Sağlamlaştırma (Hafta 1)

### G1. `getPaymentHistory` yetki doğrulaması 🟢 — EN YÜKSEK ÖNCELİK

- **Amaç:** Handler'a `managerId` parametresi ekleyip `dueId`'nin o manager'ın dairesine ait olduğunu doğrulamak.
- **Neden gerekli:** Şu an herhangi bir `dueId` ile başka manager'ın ödeme geçmişi okunabilir — veri izolasyonu kuralının (CLAUDE.md §5.2) tek bilinen ihlali.
- **Fayda:** Veri izolasyonu tutarlılığı; ileride çok bina desteğinin ön koşulu.
- **Teknik etki:** IPC parametre değişikliği (kullanıcı onayı gerekir).
- **Bağımlılık:** Yok.
- **Risk:** Düşük — mevcut çağıran tek yer `Apartments.jsx`/`Dues` akışı; `managerId` zaten oturumda mevcut.
- **Dosyalar:** `electron/modules/dues/handlers.js`, `dues/service.js` (JOIN ile sahiplik kontrolü), `preload.js`, çağıran sayfa.
- **Test:** doğru manager → liste döner; yanlış manager/geçersiz dueId → `{success:false}`.
- **Tamamlanma kriteri:** Yetkisiz `dueId` ile geçmiş okunamaz; mevcut ekran davranışı değişmez; CLAUDE.md §5.2'deki "bilinen açık" notu silinir.

### G2. ESLint `no-unused-vars` → `error` 🟢

- **Amaç/Neden:** Ölü kod birikimini derleme öncesi yakalamak.
- **Dosyalar:** `eslint.config.js` + çıkan ihlallerin temizliği.
- **Tamamlanma kriteri:** `npm run lint` sıfır hata.

### G3. Kritik iş kurallarına birim test 🟡

- **Amaç:** Vitest altyapısı mevcut ama kapsam dar; en riskli mantığı test altına almak.
- **Neden gerekli:** Finansal hesaplar (paid_amount SUM, iptal zinciri) regresyona en açık alan; testler sonraki fazların güvenlik ağıdır.
- **Kapsam (öncelik sırasıyla):** `dues/service.js` (recordPayment, cancelPayment, status geçişleri), `auth/service.js` (setup/kurtarma akışı), `migrate.js` (fresh install / duplicate column senaryoları) — testlerde in-memory SQLite (`new Database(":memory:")`) kullan.
- **Bağımlılık:** Yok; Faz 2+ görevlerinden **önce** yapılmalı.
- **Tamamlanma kriteri:** `npm run test` yeşil; recordPayment/cancelPayment akışının uçları kapsanmış.

---

## Faz 2 — Hızlı Kazanımlar (Hafta 2–3)

### Ö1. Aidat Hatırlatma 🟢

- **Amaç:** Ay sonu yaklaşınca ödenmemiş daireler için uygulama içi özet/uyarı.
- **Fayda:** Yöneticinin en sık sorduğu soru ("kim ödemedi?") tek bakışta cevaplanır.
- **Teknik etki:** Yeni IPC gerekmez — `getStats` sorgusu genişletilir (aynı endpoint, ek alan).
- **Kapsam:** Dashboard'da "Bu ay ödenmemiş: X daire" kartı; ayın son 5 günü vurgulu gösterim; detay listesi (daire no, sakin adı, kalan tutar).
- **Dosyalar:** `electron/modules/dashboard/service.js`, `src/pages/Dashboard/Dashboard.jsx`.
- **Test:** ödenmemiş/kısmi/tam ödenmiş karışımı; ay sınırı (ayın 1'i ve son günü); pasif daireler sayılmamalı.
- **Tamamlanma kriteri:** Kart doğru sayıyı gösterir, detay listesi açılır, pasif daireler hariçtir.

### Ö3. Gelişmiş Filtreler (Transactions) 🟡

- **Amaç:** `Transactions.jsx`'e filtre paneli: tarih aralığı, kategori çoklu seçim, tür (gelir/gider/hepsi), durum (aktif/iptal/hepsi).
- **Fayda:** Kayıt sayısı arttıkça işlem bulmak mümkün olur; T2 sayfalamanın ön hazırlığı.
- **Teknik etki:** `getTransactions` parametreleri genişler (IPC değişikliği — kullanıcı onayı). Filtreleme **SQL'de** yapılır (CLAUDE.md §14), dinamik WHERE her zaman parametreli.
- **Dosyalar:** `financial/handlers.js`, `financial/service.js`, `preload.js`, `Transactions.jsx`.
- **Test:** her filtrenin tekil ve kombinasyonlu çalışması; boş sonuç; geçersiz tarih formatı reddedilir; SQL injection denemesi (parametreli olduğu doğrulanır).
- **Tamamlanma kriteri:** Filtreler kombinlenebilir, sonuç SQL'den filtreli döner, mevcut varsayılan görünüm değişmez.

---

## Faz 3 — Raporlama ve Veri Çıkışı (Hafta 4–5)

### Ö4. PDF Makbuz 🟡

- **Amaç:** Ödeme kaydedilince yazdırılabilir makbuz üretme (`jspdf` zaten bağımlılıkta).
- **Fayda:** Sakine elden verilebilir resmi kayıt; en çok istenen özelliklerden.
- **Teknik etki:** Yeni bağımlılık yok; mevcut `saveReportFile` IPC'si yeniden kullanılır (yeni endpoint gerekmeyebilir — üretim renderer'da).
- **Kapsam:** Makbuz içeriği: daire no, sakin adı, tutar, ödeme yöntemi, tarih, tahsil eden. `recordPayment` başarı modalına "Makbuz Yazdır" butonu; geçmiş ödemeler için de erişilebilir olmalı.
- **Bağımlılık:** Yok (Reports'taki mevcut PDF deseni örnek alınır).
- **Risk:** jspdf'te Türkçe karakter desteği — Reports'ta çözülmüş font yaklaşımını aynen kullan.
- **Dosyalar:** `src/pages/Apartments/Apartments.jsx` (veya ödeme modal bileşeni), yeni `src/utils/receipt.js`.
- **Test:** Türkçe karakterler, uzun sakin adı, kısmi ödeme tutarı, iptal edilmiş ödeme için makbuz üretilememesi.
- **Tamamlanma kriteri:** Ödeme sonrası tek tıkla doğru içerikli PDF kaydedilir.

### Ö5. CSV / Excel Dışa Aktarım 🟡

- **Amaç:** Transactions ve Reports verilerini dosyaya aktarma.
- **Fayda:** Yönetici verisini muhasebeciyle/kurulla paylaşabilir.
- **Teknik etki:** ⚠️ **Karar gerekli:** `xlsx` paketi (gerçek Excel, +1 bağımlılık) vs CSV (bağımlılıksız, Excel'in UTF-8 BOM ihtiyacı var). Öneri: **CSV + UTF-8 BOM** ile başla — bağımlılık eklemeden ihtiyacın %90'ını karşılar. Kullanıcıya sor.
- **Bağımlılık:** Ö3 (filtrelenmiş sonucun aktarılması en değerli senaryo).
- **Dosyalar:** `Transactions.jsx`, `Reports.jsx`, `saveReportFile` yolu (uzantı filtresi genişletme: `report/handlers.js`).
- **Test:** Türkçe karakter + BOM (Excel'de doğru açılma), ₺ tutar formatı, iptal kayıtların işaretlenmesi, boş liste.
- **Tamamlanma kriteri:** "Dışa Aktar" butonu filtreli veriyi Excel'de sorunsuz açılan dosyaya yazar.

### Ö6. Dashboard Trend Grafiği 🟡

- **Amaç:** Son 6 aya ait gelir/gider trend grafiği.
- **Fayda:** Finansal gidişatın tek bakışta görülmesi.
- **Teknik etki:** ⚠️ **Karar gerekli:** `recharts` (+~100KB bağımlılık) vs saf SVG. Öneri: **saf SVG** — 6 çubuk/çizgilik basit grafik için bağımlılık maliyetine değmez; tema değişkenleriyle de doğal uyumlu. Yeni IPC endpoint gerekir (`getMonthlyTrend`) — kullanıcıya sor.
- **Bağımlılık:** Yok.
- **Dosyalar:** `channels.js`, `financial/handlers.js`, `financial/service.js` (`getMonthlyTrend(managerId, monthCount)`), `preload.js`, `Dashboard.jsx`, yeni `src/components/TrendChart.jsx`.
- **Test:** verisiz aylar (0 gösterimi), yıl geçişi (Kasım→Şubat aralığı), iptal kayıtların hariç tutulması, dark tema görünümü.
- **Tamamlanma kriteri:** Dashboard'da Türkçe ay etiketli (Oca, Şub…) 6 aylık grafik; iptal kayıtlar toplamda yok.

---

## Faz 4 — Veri Güvenliği Altyapısı (Hafta 6–7)

### A1. Otomatik Yedekleme Zamanlayıcısı 🔴

- **Amaç:** Uygulama açıkken her gün belirlenen saatte `%APPDATA%/.../backups/` klasörüne otomatik yedek; eski yedeklerin rotasyonu (ör. son 7).
- **Neden gerekli:** Tek SQLite dosyası = tek arıza noktası. Manuel yedek unutulur; disk arızası tüm apartman verisini götürür.
- **Teknik etki:** ⚠️ **Karar gerekli:** `setInterval` vs `node-cron`. Öneri: **bağımlılıksız `setInterval`** (dakikada bir "saat geldi mi + bugün alındı mı" kontrolü) — cron ifadesi gerektirecek karmaşıklık yok. Ayarların saklanması için yeni bir `settings` tablosu **veya** userData'da JSON dosyası gerekir — şema kararı olduğundan kullanıcıya sor (öneri: JSON dosyası, DB'ye ayar tablosu açmaktan hafif).
- **Kapsam:** yedekleme saati + saklanacak yedek sayısı ayarı (Profil sayfasında UI); mevcut `db.backup()` API'si; ayrıca uygulama kapanırken "bugün yedek alınmadıysa al" güvencesi düşünülebilir.
- **Bağımlılık:** Yok; A2'nin ön koşulu.
- **Risk:** Uygulama o saatte açık değilse yedek atlanır → açılışta "son yedek > 24 saat ise hemen al" telafi mantığı ekle.
- **Dosyalar:** yeni `electron/modules/backup/scheduler.js`, `backup/service.js` (dialog'suz sessiz yedek fonksiyonu ayrıştırılır), `main.js` (başlatma), ayar UI için `Profile.jsx` + gerekli IPC (kullanıcı onayı).
- **Test:** rotasyon (8. yedek → en eski silinir), saat tetiklenmesi, açılış telafisi, yedek sırasında DB meşgulken davranış.
- **Tamamlanma kriteri:** Ayarlanan saatte sessiz yedek alınır, rotasyon çalışır, son yedek zamanı UI'da görünür.

### A2. Yedek Hedef Klasörü (Bulut Senkron Uyumlu) 🟡

- **Amaç:** Kullanıcının seçtiği harici klasöre (Google Drive/OneDrive/Dropbox masaüstü senkron klasörü dahil) otomatik yedek kopyalama.
- **Neden bu yaklaşım:** OAuth tabanlı doğrudan bulut entegrasyonu (token saklama, API kotaları, her sağlayıcı için ayrı kod) bu projenin boyutuna göre aşırı karmaşık. Klasör seçimi aynı faydayı ~%10 maliyetle sağlar — senkronu işletim sistemindeki Drive/OneDrive istemcisi yapar. **OAuth seçeneği bilinçli olarak rafa kaldırıldı**; talep gelirse yeniden değerlendirilir.
- **Bağımlılık:** A1 (aynı ayar altyapısı ve sessiz yedek fonksiyonu).
- **Dosyalar:** A1'in scheduler/ayar dosyaları + `dialog.showOpenDialog` ile klasör seçimi.
- **Test:** klasör silinmiş/erişilemezse sessizce loglayıp yerel yedeğe devam; ağ sürücüsü yavaşlığında UI donmaması (async copy).
- **Tamamlanma kriteri:** Seçili klasöre her otomatik yedeğin bir kopyası düşer; klasör kaybolursa uygulama çalışmaya devam eder.

---

## Faz 5 — Ölçek ve Refactor (Hafta 8+)

### T2. Transactions Sayfalama 🟡

- **Amaç:** `getTransactions`'a `LIMIT/OFFSET` (veya keyset) sayfalama.
- **Neden:** 2–3 yıllık veri sonrası tüm işlemleri tek seferde çekmek hem senkron SQL'i hem render'ı yavaşlatır.
- **Bağımlılık:** Ö3 (filtre + sayfalama aynı sorgu üretecinde birleşir).
- **Test:** sayfa sınırları, filtre+sayfa kombinasyonu, toplam kayıt sayısı gösterimi.
- **Tamamlanma kriteri:** 10.000 kayıtlık test verisinde sayfa geçişi < 100 ms.

### T3. Çok Bina Desteği 🔴 — MİMARİ KARAR GEREKTİRİR

- **Durum:** Planlanmış değil; **başlamadan önce kullanıcıyla detaylı konuşulacak.**
- **Mevcut analiz:** `manager_id` bazlı veri modeli buna kısmen hazır, ancak UI tek bina varsayar. Gerekli olurlarsa: `buildings` tablosu + `apartments.building_id`, bina seçici UI, `currentBuilding` oturum state'i, tüm sorgulara bina filtresi.
- **Ön koşullar:** G1 (yetki deseni), T2 (veri hacmi artacak), kapsamlı test (G3).

---

## Teknik Borç Analizi

| # | Borç | Risk | Öneri |
| - | ---- | ---- | ----- |
| 1 | `getPaymentHistory` sahiplik doğrulamıyor | Veri izolasyonu ihlali | **G1 — Faz 1'de kapat** |
| 3 | Test kapsamı dar | Finansal mantıkta sessiz regresyon | G3; yeni service fonksiyonu = beraberinde test |
| 5 | `getTransactions` sınırsız satır döner | Büyüyen veride UI/IPC yavaşlaması | T2 sayfalama |
| 6 | Para `REAL` (float) | Kuruş yuvarlama sapmaları birikebilir | Bilinçli karar (ADR #8); şikâyet gelirse kuruş-integer migration planla — şimdilik dokunma |
| 7 | Ayar saklama altyapısı yok | A1/A2 ve gelecek özellikler engelleniyor | A1 kapsamında JSON tabanlı settings modülü |
| 8 | `sandbox:false` | Electron güvenlik yüzeyi | Preload'un require ihtiyacı kalkarsa (bundle edilirse) `sandbox:true`'ya geç — düşük öncelik |
| 9 | Renderer'da hata loglanmıyor | Kullanıcı hatası teşhis edilemiyor | İleride `window.onerror` → IPC → electron-log köprüsü (yeni kanal, kullanıcıya sor) |
| 10 | Rapor sorgularında index denetimi yapılmadı | Veri büyüyünce yavaş rapor | T2 ile birlikte `EXPLAIN QUERY PLAN` kontrolü; gerekirse `dues(year,month)`, `incomes(manager_id,date)` indexleri |
| 11 | Dialog renkleri JS'ten inline yazılıyor (`alert.js` → `theme()`/`base()`, `confirmButtonColor` vb.) | Renkler dialog açıldığı anda donuyor: dialog açıkken tema değiştirilirse zemin/butonlar eski temada kalır, `swal-*` sınıflarıyla gelen renkler yeni temaya geçer → karışık görünüm (ör. lacivert zeminde açık tema uyarı kutusu okunmaz) | Popup/buton renklerini `style.css`'e CSS değişkeni olarak taşı, `theme()`'i kaldır. Tüm dialogları etkiler, gözle regresyon kontrolü ister — ayrı görev. Gerçek kullanımda düşük olasılık (kullanıcı dialog açıkken tema değiştirmiyor), o yüzden düşük öncelik |

---

## Gelecek Özellik Fikirleri (Roadmap dışı — değer sırasıyla)

1. **Genel audit log** — `payment_cancellations` deseninin genellemesi: kim, ne zaman, hangi kaydı değiştirdi. Yönetim değişimlerinde hesap verebilirlik sağlar.
2. **Yıllık genel kurul raporu** — mevcut rapor altyapısıyla yıl özeti PDF (gelir/gider dökümü, aidat tahsilat oranı). Yöneticinin yasal ihtiyacı.
3. **Borç geçmişi ekranı** — daire bazında tüm yılların ödenmemiş aidatlarının tek listesi (şu an ay ay gezmek gerekiyor).
4. **Veri içe aktarım** — Excel'den toplu daire/sakin aktarımı; ilk kurulum süresini dakikalara indirir (Ö5'in tersi, aynı format).
5. **Bakım modu / kilit ekranı** — yönetici masadan kalkınca hızlı kilit (şifre ile açma); ortak kullanılan bilgisayarlarda gizlilik.
6. **Gider bütçesi** — kategori bazlı aylık bütçe + aşım uyarısı; Dashboard kartı olarak.
7. **Performans izleme (dev)** — yavaş IPC çağrılarını (>100 ms) electron-log'a yazan basit sarmalayıcı; teknik borç #10'un erken uyarısı.

Bilinçli olarak **eklenmeyecekler:** bildirim/e-posta gönderimi (offline ilkesine aykırı, SMTP yapılandırma yükü), plugin mimarisi (tek geliştirici + kapalı kapsam için aşırı mühendislik), çevrimiçi senkron/çoklu cihaz (sunucusuz mimari temel karar).

---

## Optimizasyon Önerileri (kod yazmadan tespit — uygulaması ayrı görev)

- **SQLite:** Sorgu planları hiç denetlenmedi; T2 sırasında kritik sorgulara `EXPLAIN QUERY PLAN` bak. `PRAGMA optimize` kapanışta zaten çalışıyor — yeterli.
- **React:** Sayfalar lazy — iyi. Büyük listelerde (Apartments/ApartmentsManage, Transactions) satır bileşenlerini `memo`lamak T2 sırasında değerlendirilebilir; öncesinde ölçmeden optimize etme.
- **IPC:** Tek seferde büyük payload dönen çağrılar (getTransactions) T2 ile sınırlanacak; bunun dışında darboğaz yok.
- **Electron:** `sandbox:true` geçişi (borç #8) ve CSP header'ı eklenmesi orta vadeli güvenlik iyileştirmeleri; ikisi de davranış kırma riski taşır, ayrı görev olarak ve kullanıcı onayıyla.
- **Bundle:** Yeni bağımlılık eklerken önce mevcut stack'le çözülebilir mi diye bak (Ö5/Ö6 önerileri bu ilkeyle "bağımlılıksız" seçildi).

---

## Kararı Verilmemiş Konular

| Konu | Seçenekler | Öneri (gerekçesi yukarıdaki görevde) |
| ---- | ---------- | ------------------------------------ |
| Trend grafiği (Ö6) | `recharts` vs saf SVG | Saf SVG |
| Dışa aktarım (Ö5) | `xlsx` paketi vs CSV+BOM | CSV+BOM |
| Yedek zamanlayıcı (A1) | `setInterval` vs `node-cron` | `setInterval` |
| Ayar saklama (A1) | `settings` tablosu vs userData JSON | userData JSON |
| Bulut yedek (A2) | OAuth vs senkron klasörü | Senkron klasörü (OAuth rafa kalktı) |

Bu kararlar ilgili göreve başlarken kullanıcıya sorulur; onaylanan karar bu tablodan silinip görev metnine işlenir.

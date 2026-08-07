# Mavikent Site Yönetimi — Geliştirme Roadmap'i

Bu dosya geliştirme planını, teknik borç analizini ve gelecek fikirlerini içerir.
Mevcut durum ve mimari için bkz. `CLAUDE.md`.

> **Kurallar:**
>
> - Bir görev tamamlandığında ilgili bölüm bu dosyadan **silinir**; davranış değiştiyse `CLAUDE.md` güncellenir.
> - Zorluk skalası: 🟢 kolay (< yarım gün) · 🟡 orta (1–2 gün) · 🔴 zor (3+ gün / mimari karar)
> - Fazlar **önem ve bağımlılık sırasındadır**, takvim değildir — üstteki bitmeden alttakine geçme (aynı faz içindekiler paralel yapılabilir).
> - Bağımlılıksız çözüm tercih edilir (CLAUDE.md ADR #30). Bu roadmap'teki teknik seçimler o karara göre işlenmiştir, görev başlarken yeniden tartışılmaz.

---

## Faz 1 — Sağlamlaştırma

### G2. ESLint `no-unused-vars` → `error` 🟢

- **Amaç/Neden:** Ölü kod birikimini derleme öncesi yakalamak.
- **Dosyalar:** `eslint.config.js` + çıkan ihlallerin temizliği.
- **Tamamlanma kriteri:** `npm run lint` sıfır hata.

---

## Faz 2 — Hızlı Kazanımlar

### Ö1. Aidat Hatırlatma 🟢

- **Amaç:** Ay sonu yaklaşınca ödenmemiş daireler için uygulama içi özet/uyarı.
- **Fayda:** Yöneticinin en sık sorduğu soru ("kim ödemedi?") tek bakışta cevaplanır.
- **Teknik etki:** Yeni IPC gerekmez — `getStats` sorgusu genişletilir (aynı endpoint, ek alan).
- **Kapsam:** Dashboard'da "Bu ay ödenmemiş: X daire" kartı; ayın son 5 günü vurgulu gösterim; detay listesi (daire no, sakin adı, kalan tutar).
- **Dosyalar:** `electron/modules/dashboard/service.js`, `src/pages/Dashboard/Dashboard.jsx`.
- **Doğrulama:** ödenmemiş/kısmi/tam ödenmiş karışımı; ay sınırı (ayın 1'i ve son günü); pasif daireler sayılmamalı.
- **Tamamlanma kriteri:** Kart doğru sayıyı gösterir, detay listesi açılır, pasif daireler hariçtir.

### Ö3. Gelişmiş Filtreler (Transactions) 🟡

> **Kısmen yapıldı (2026-08-02, U-14):** Dönem filtresi (yıl + ay, "Tüm Zamanlar" seçeneğiyle) eklendi ve **SQL'de** çalışıyor — `getTransactions(buildingId, period)`, `date >= ? AND date < ?` aralığıyla, mevcut `(building_id, date)` index'ini kullanacak şekilde. Tür filtresi (gelir/gider/hepsi) zaten vardı. **Kalan kapsam aşağıdadır.**

- **Amaç:** `Transactions.jsx`'e filtre paneli: **serbest tarih aralığı** (tek ay değil), kategori çoklu seçim, durum (aktif/iptal/hepsi).
- **Fayda:** Kayıt sayısı arttıkça işlem bulmak mümkün olur; T2 sayfalamanın ön hazırlığı.
- **Teknik etki:** `getTransactions`'ın `period` parametresi genişler (IPC imzası zaten değişti, kanal aynı). Filtreleme **SQL'de** yapılır (CLAUDE.md §14), dinamik WHERE her zaman parametreli.
- **Dosyalar:** `financial/handlers.js`, `financial/service.js`, `preload.js`, `Transactions.jsx`.
- **Doğrulama:** her filtrenin tekil ve kombinasyonlu çalışması; boş sonuç; geçersiz tarih formatı reddedilir; sorgunun parametreli kaldığı gözden geçirilir.
- **Tamamlanma kriteri:** Filtreler kombinlenebilir, sonuç SQL'den filtreli döner, mevcut varsayılan görünüm değişmez.

---

## Faz 3 — Raporlama ve Veri Çıkışı

### Ö4. PDF Makbuz 🟡

- **Amaç:** Ödeme kaydedilince yazdırılabilir makbuz üretme (`jspdf` zaten bağımlılıkta).
- **Fayda:** Sakine elden verilebilir resmi kayıt; en çok istenen özelliklerden.
- **Teknik etki:** Yeni bağımlılık yok; mevcut `saveReportFile` IPC'si yeniden kullanılır (yeni endpoint gerekmeyebilir — üretim renderer'da).
- **Kapsam:** Makbuz içeriği: daire no, sakin adı, tutar, ödeme yöntemi, tarih, tahsil eden. `recordPayment` başarı modalına "Makbuz Yazdır" butonu; geçmiş ödemeler için de erişilebilir olmalı.
- **Bağımlılık:** Yok (Reports'taki mevcut PDF deseni örnek alınır).
- **Risk:** jspdf'te Türkçe karakter desteği — Reports'ta çözülmüş font yaklaşımını aynen kullan.
- **Dosyalar:** `src/pages/Apartments/components/PaymentModal.jsx`, yeni `src/utils/receipt.js`.
- **Doğrulama:** Türkçe karakterler, uzun sakin adı, kısmi ödeme tutarı, iptal edilmiş ödeme için makbuz üretilememesi.
- **Tamamlanma kriteri:** Ödeme sonrası tek tıkla doğru içerikli PDF kaydedilir.

### Ö5. CSV Dışa Aktarım 🟡

- **Amaç:** Transactions ve Reports verilerini dosyaya aktarma.
- **Fayda:** Yönetici verisini muhasebeciyle/kurulla paylaşabilir.
- **Teknik seçim (karara bağlandı):** **CSV + UTF-8 BOM**, `xlsx` paketi eklenmez (ADR #30). BOM olmadan Excel Türkçe karakterleri bozar, bu yüzden dosya başına BOM yazmak zorunludur.
- **Bağımlılık:** Ö3 (filtrelenmiş sonucun aktarılması en değerli senaryo).
- **Dosyalar:** `Transactions.jsx`, `Reports.jsx`, `saveReportFile` yolu (uzantı filtresi genişletme: `report/handlers.js`).
- **Doğrulama:** Türkçe karakter + BOM (Excel'de doğru açılma), ₺ tutar formatı, iptal kayıtların işaretlenmesi, boş liste.
- **Tamamlanma kriteri:** "Dışa Aktar" butonu filtreli veriyi Excel'de sorunsuz açılan dosyaya yazar.

### Ö6. Dashboard Trend Grafiği 🟡

- **Amaç:** Son 6 aya ait gelir/gider trend grafiği.
- **Fayda:** Finansal gidişatın tek bakışta görülmesi.
- **Teknik seçim (karara bağlandı):** **Saf SVG**, `recharts` eklenmez (ADR #30). Tema değişkenleriyle doğal uyumlu. Yeni IPC endpoint gerekir (`getMonthlyTrend`) — endpoint eklenmesi için kullanıcı onayı alınır.
- **Bağımlılık:** Yok.
- **Dosyalar:** `channels.js`, `financial/handlers.js`, `financial/service.js` (`getMonthlyTrend(buildingId, monthCount)`), `preload.js`, `Dashboard.jsx`, yeni `src/components/TrendChart.jsx`.
- **Doğrulama:** verisiz aylar (0 gösterimi), yıl geçişi (Kasım→Şubat aralığı), iptal kayıtların hariç tutulması, dark tema görünümü.
- **Tamamlanma kriteri:** Dashboard'da Türkçe ay etiketli (Oca, Şub…) 6 aylık grafik; iptal kayıtlar toplamda yok.

---

## Faz 4 — Veri Güvenliği Altyapısı

### A1. Otomatik Yedekleme Zamanlayıcısı 🔴

> **Ön koşulların bir kısmı 2026-08-05'te geri alındı (ADR #39).** Duran kısım: dialog'suz yedek yolu (`runBackup(win, { silent: true })`), `backup` IPC domaini (`backup:run`) ve Profile'daki "Yedek Al" butonu. **Silinen kısım:** ayar saklama altyapısı (`shared/appSettings.js` → `settings.json`), `backup:get-status` kanalı, son yedek tarihi göstergesi ve Dashboard uyarı şeridi. Bu madde yapılacaksa **ayar saklama katmanı sıfırdan kurulmalıdır**, bu yüzden zorluk 🟡'den 🔴'ya geri döndü.

- **Amaç:** Uygulama açıkken her gün belirlenen saatte `%APPDATA%/.../backups/` klasörüne otomatik yedek; eski yedeklerin rotasyonu (ör. son 7).
- **Neden gerekli:** Tek SQLite dosyası = tek arıza noktası. Manuel yedek unutulur; disk arızası tüm apartman verisini götürür.
- **Teknik seçim (karara bağlandı):** Zamanlayıcı **bağımlılıksız `setInterval`** (dakikada bir "saat geldi mi + bugün alındı mı" kontrolü) — ADR #30. Ayar saklama için ADR #30'un tercihi hâlâ geçerlidir (userData altında JSON dosyası, `settings` tablosu değil), ama dosya artık yok, yeniden yazılması gerekir.
- **Kalan kapsam:** yedekleme saati + saklanacak yedek sayısı ayarı (Profile'daki mevcut "Veri Yedeği" kartına eklenir); hedef klasöre sessiz yazan varyant (bugünkü `runBackup` kullanıcıdan dosya yolu ister — zamanlayıcı için yol sormayan bir sürüm gerekir); rotasyon; uygulama kapanırken "bugün yedek alınmadıysa al" güvencesi.
- **Bağımlılık:** Yok; A2'nin ön koşulu.
- **Risk:** Uygulama o saatte açık değilse yedek atlanır → açılışta "son yedek > 24 saat ise hemen al" telafi mantığı ekle. Bu kontrol için gereken `lastBackupAt` kaydı artık tutulmuyor, ayar katmanıyla birlikte geri getirilmesi gerekir.
- **Dosyalar:** yeni `electron/modules/backup/scheduler.js`, `backup/service.js` (yol sormayan yedek fonksiyonu), `main.js` (başlatma), ayar UI için `Profile.jsx` + gerekli IPC (kullanıcı onayı).
- **Doğrulama:** rotasyon (8. yedek → en eski silinir), saat tetiklenmesi, açılış telafisi, yedek sırasında DB meşgulken davranış.
- **Tamamlanma kriteri:** Ayarlanan saatte sessiz yedek alınır, rotasyon çalışır, son yedek zamanı UI'da görünür.

### A2. Yedek Hedef Klasörü (Bulut Senkron Uyumlu) 🟡

- **Amaç:** Kullanıcının seçtiği harici klasöre (Google Drive/OneDrive/Dropbox masaüstü senkron klasörü dahil) otomatik yedek kopyalama.
- **Teknik seçim (karara bağlandı):** Klasör seçimi, **OAuth tabanlı bulut entegrasyonu değil** (ADR #30). Senkronu işletim sistemindeki Drive/OneDrive istemcisi yapar.
- **Bağımlılık:** A1'in zamanlayıcısı (ayar altyapısı ve sessiz yedek yolu U-10 ile hazır).
- **Dosyalar:** A1'in scheduler/ayar dosyaları + `dialog.showOpenDialog` ile klasör seçimi.
- **Doğrulama:** klasör silinmiş/erişilemezse sessizce loglayıp yerel yedeğe devam; ağ sürücüsü yavaşlığında UI donmaması (async copy).
- **Tamamlanma kriteri:** Seçili klasöre her otomatik yedeğin bir kopyası düşer; klasör kaybolursa uygulama çalışmaya devam eder.

---

## Faz 5 — Ölçek ve Refactor

### T2. Transactions Sayfalama 🟡

- **Amaç:** `getTransactions`'a `LIMIT/OFFSET` (veya keyset) sayfalama.
- **Neden:** 2–3 yıllık veri sonrası tüm işlemleri tek seferde çekmek hem senkron SQL'i hem render'ı yavaşlatır.
- **Bağımlılık:** Ö3 (filtre + sayfalama aynı sorgu üretecinde birleşir).
- **Doğrulama:** sayfa sınırları, filtre+sayfa kombinasyonu, toplam kayıt sayısı gösterimi.
- **Tamamlanma kriteri:** 10.000 kayıtlık test verisinde sayfa geçişi < 100 ms.

---

## Arayüz ve Görsel İşler

Özellik değil, tutarlılık borcu. Hepsi düşük öncelik, sıra bağımlılığı yok.

1. **Okunabilirlik eşiği (1rem) taşıması** — CLAUDE.md §11 eşiği 1rem'dir, eski sayfalar hâlâ altındadır. `Login`, `Setup` ve `Recover` tamamlandı. Kalanlar: `Apartments.css`, `Residents.css`, `Reports.css`, `Transactions.css`, `Profile.css`, `Dashboard.css`, `AddApartment.css`, `Footer.css`, `ErrorBoundary.css`, `style.css`. **Toplu sweep yapma** — yoğun tablo sayfalarında satır yüksekliği ve sütun genişliği değişir, her sayfa iki temada gözle doğrulanmalıdır.
2. **Setup ve splash arka planları** — `setup/light.jpg` (2026-07-19) node-network motifi korunarak maviye yeniden üretildi, ADR #17 paletiyle uyumlu. `setup/dark.jpg` hâlâ **teal** ve sayfadaki tek uyumsuz parça: aynı motifin mavi karşılığı üretilmeli (bright azure `#38a5f7` + `#29c1fb` düğümler, lacivert `#0a1220` zemin, solda yoğun / sağda boş 16:9). `splash/bg.jpg` hâlâ eski görselinde.
3. **Motif birliği** — setup node-network, login soyut apartman çizgi işi. ADR #15 "giriş ekranlarının tamamı aynı görsel dilde" diyor, uzun vadede ikisi tek aileye çekilmeli.
4. **Setup sol sütun metinleri** — "Başlamadan Önce" uyarı kutusu ve "Kurulumdan Sonra" özellik listesi (2026-07-20) yeniden yazıldı. Liste **uygulamanın o anki yeteneklerini** anlatır, bu yüzden yeni özellikler geldikçe gözden geçirilmeli (Ö4 makbuz, Ö5 dışa aktarım, Ö6 trend grafiği, A1 otomatik yedekleme). Kısıtlar: dört madde tek satırda kalmalı (en uzunu ~45 karakter), fiiller emir kipinde, `Kurulumdan Sonra` ve `Başlamadan Önce` başlıkları aynı stili paylaşır (`.setup-notice-title` / `.setup-adv-label`). A1 geldiğinde yedekleme maddesi "otomatik" vurgusuyla güncellenmeli.
5. **Giriş ekranlarının paralel tema değişkenleri** — `Setup.css`, `Login.css` ve `Recover.css` kendi setlerini taşır (`--setup-*`, `--login-*`, `--recover-*`), `style.css`'teki global token'lardan bağımsız. Global accent değişince bu ekranlar eski renkte kalır (v1.4.0 ve v1.5.0 yenilemelerinde bu maliyet iki kez görüldü). Tam ekran düzenleri ve kendi arka plan görselleri olduğu için ayrılık bilinçli, ama en azından `Login`/`Recover` ikilisi tek sete indirilebilir (kardeş ekranlar, aynı değerler). Birleştirmede ADR #20 korunmalı: geometri kurala literal yazılır, değişken yalnızca renk taşır. **Not (2026-08-02):** `Setup` ve `Recover`'ın form alanı artık paylaşılan `FormField` bileşenindedir (ADR #40) ve rengi `--ff-*` sözleşmesiyle alır; yani bu iki ekranın alan görünümü zaten tek kaynaktan geliyor. Kalan ayrılık kart/arka plan/buton token'larında.

---

## Teknik Borç Analizi

| #   | Borç                                              | Risk                                                        | Öneri                                                                                                                                                     |
| --- | ------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `getTransactions` dönem filtresizken sınırsız satır döner | Azaldı: sayfa varsayılan olarak tek ay çeker (U-14), ama "Tüm Zamanlar" seçeneği hâlâ sınırsız | T2 sayfalama (yalnızca "Tüm Zamanlar" yolu için kritik)                                                                                                   |
| 2   | Para `REAL` (float)                               | Kuruş yuvarlama sapmaları birikebilir                       | Bilinçli karar (ADR #8); şikâyet gelirse kuruş-integer migration planla, şimdilik dokunma                                                                  |
| 4   | `sandbox:false`                                   | Electron güvenlik yüzeyi                                    | Preload'un require ihtiyacı kalkarsa (bundle edilirse) `sandbox:true`'ya geç, düşük öncelik                                                                |
| 5   | Renderer hatalarında stack trace yok              | Azaldı (2026-08-05): renderer konsolunun `error`/`warning` satırları artık main.log'a düşüyor (ADR #53). Kalan eksik, yapısal stack trace | Şimdilik dokunma. Konsol metni bir arızayı yerinde göstermeye yetmezse `electronAPI` üzerinden kendi kanalımız açılır (`window.onerror` + `unhandledrejection` → yeni kanal, 4 dosyalık standart tur, kullanıcıya sor) ve `catchRendererConsole` silinir. **electron-log'un renderer köprüsü bu iş için kullanılmayacak** (whitelist dışı ikinci köprü, ADR #53) ve hazır `spyRendererConsole` seçeneği Electron 41 ile uyumsuz (paket olayı eski konumsal imzayla dinliyor, main.log'a `undefined` yazar) |
| 6   | Rapor sorgularında index denetimi yapılmadı       | Veri büyüyünce yavaş rapor                                  | T2 ile birlikte `EXPLAIN QUERY PLAN` kontrolü; gerekirse `dues(year,month)`, `incomes(building_id,date)` indexleri                                         |
| 7   | Dialog renkleri JS'ten inline yazılıyor           | Dialog açıkken tema değişirse zemin eski, `swal-*` sınıfları yeni temada kalır → okunamayan karışık görünüm | Popup/buton renklerini `style.css`'e CSS değişkeni olarak taşı, `alert.js`'teki `theme()`'i kaldır. Tüm dialogları etkiler, gözle regresyon ister. Gerçek kullanımda düşük olasılık, düşük öncelik |
| 8   | `.prettierrc` yok, kod ~100 karakter genişlikte   | `npx prettier --check` neredeyse her dosyayı uyumsuz gösteriyor, format denetimi sinyal üretmiyor | Projenin gerçek genişliğini tespit edip config dosyası ekle. **Mevcut dosyaları aynı değişiklikte reformat etme** — tek seferde tüm repo'yu biçimlendirmek gerçek değişiklikleri gömer |
| 9   | Yakalanmamış hatadan sonra süreç ayakta kalıyor   | Kutu "kapatıp yeniden açın" diyor ama uygulama çalışmaya devam ediyor, kullanıcı bozuk state'te kayıt girmeyi sürdürebilir | **Bilinçli karar (2026-08-05): dokunma.** `onError` içinde `app.quit()` çağırmak, zararsız bir hatada (ör. bir stream'den gelen EPIPE) kullanıcının yarım kalan form girişini keser ve veri kaybı riski, teşhis edilmemiş bir hata riskinden büyüktür. Kutu tek seferlik olduğu için (`fatalErrorShown`) ekran da kilitlenmez. Sahadan "hata sonrası uygulama garip davranıyor" bildirimi gelirse yeniden değerlendirilir |

---

## Gelecek Özellik Fikirleri (Roadmap dışı — değer sırasıyla)

1. **Genel audit log** — `payment_cancellations` deseninin genellemesi: kim, ne zaman, hangi kaydı değiştirdi. Yönetim değişimlerinde hesap verebilirlik sağlar.
2. **Yıllık genel kurul raporu** — mevcut rapor altyapısıyla yıl özeti PDF (gelir/gider dökümü, aidat tahsilat oranı). Yöneticinin yasal ihtiyacı.
3. **Borç geçmişi ekranı** — daire bazında tüm yılların ödenmemiş aidatlarının tek listesi (şu an ay ay gezmek gerekiyor).
4. **Veri içe aktarım** — Excel'den toplu daire/sakin aktarımı; ilk kurulum süresini dakikalara indirir (Ö5'in tersi, aynı format).
5. **Bakım modu / kilit ekranı** — yönetici masadan kalkınca hızlı kilit (şifre ile açma); ortak kullanılan bilgisayarlarda gizlilik.
6. **Gider bütçesi** — kategori bazlı aylık bütçe + aşım uyarısı; Dashboard kartı olarak.
7. **Performans izleme (dev)** — yavaş IPC çağrılarını (>100 ms) electron-log'a yazan basit sarmalayıcı; teknik borç #6'nın erken uyarısı.
8. **Hesap devri — kişi bazlı geçmiş koruması** — Bugünkü `transferAccount` devri satırı **yerinde overwrite** eder (`manager_name` + geçici şifre değişir, aynı `users.id` kalır); geçmiş `collected_by`/`cancelled_by` bağları böylece hep aynı hesabı gösterir, "hangi kişi tahsil etti" bilgisi kopar. Alternatif model: devirde yeni yönetici için **yeni `users` satırı** açılır, eski satır `is_active=0` ile arşivlenir. Böylece her ödemenin/iptalin gerçek sahibi (kişi) korunur, giriş her zaman aktif satırla yapılır. **`users.is_active` kolonu bu özellik için bilinçli olarak korunuyor** (bugün yazılmıyor, hep 1; login + createBuilding owner kontrolünde okunuyor — CLAUDE.md §7.2). Bu modele geçilirse: `transferAccount` yeniden yazılır, `getSetupState`/`regenerateRecoveryCode`/`completeSetup`'ın "tek satır" varsayımı (`ORDER BY id LIMIT 1`) çok satıra göre gözden geçirilir (aktif satır seçimi), devir sonrası eski satırın binaları (`owner_id`) yeni satıra taşınır.

Bilinçli olarak **eklenmeyecekler:** bildirim/e-posta gönderimi (offline ilkesine aykırı, SMTP yapılandırma yükü), plugin mimarisi (tek geliştirici + kapalı kapsam için aşırı mühendislik), çevrimiçi senkron/çoklu cihaz (sunucusuz mimari temel karar), kalıcı oturum (ADR #29), otomatik test paketi (kullanıcı tercihi: şimdilik test yazılmıyor, doğrulama elle yapılır).

---

## Optimizasyon Önerileri (kod yazmadan tespit — uygulaması ayrı görev)

- **SQLite:** Sorgu planları hiç denetlenmedi; T2 sırasında kritik sorgulara `EXPLAIN QUERY PLAN` bak. `PRAGMA optimize` kapanışta zaten çalışıyor, yeterli.
- **React:** Sayfalar lazy, iyi durumda. Büyük listelerde (Apartments, Transactions) satır bileşenlerini `memo`lamak T2 sırasında değerlendirilebilir; öncesinde ölçmeden optimize etme.
- **IPC:** Tek seferde büyük payload dönen çağrılar (getTransactions) T2 ile sınırlanacak; bunun dışında darboğaz yok.
- **Electron:** `sandbox:true` geçişi (borç #4) ve CSP header'ı eklenmesi orta vadeli güvenlik iyileştirmeleri; ikisi de davranış kırma riski taşır, ayrı görev olarak ve kullanıcı onayıyla.
- **Bundle:** Yeni bağımlılık eklerken önce mevcut stack'le çözülebilir mi diye bak (ADR #30).

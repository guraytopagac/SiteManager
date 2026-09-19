# Mavikent Site Yönetimi: Teknik Borç ve İyileştirme Listesi

> **Bu dosya 2026-08-08'de sıfırdan, yalnızca kod tabanı okunarak üretildi.** Önceki sürümde duran özellik planı (PDF makbuz, CSV dışa aktarım, trend grafiği, otomatik yedekleme zamanlayıcısı, gelecek fikirleri listesi) kodda karşılığı olmadığı için taşınmadı ve **artık hiçbir yerde kayıtlı değildir**. Aşağıdaki her madde koddan ölçülerek çıkarılmıştır ve her birinin yanında yeniden doğrulama komutu vardır.
>
> **Kurallar:**
>
> - Bir madde tamamlandığında bu dosyadan **silinir**. Davranış değiştiyse `CLAUDE.md` aynı commit'te güncellenir.
> - Zorluk: 🟢 kolay (< yarım gün) · 🟡 orta (1-2 gün) · 🔴 zor (3+ gün ya da mimari karar)
> - Sıra öncelik değil **kategori**dir. Kodda ölçülebilen bir öncelik sinyali yoktur, sıralamayı iş ihtiyacı belirler.
> - Buraya bayatlayan değer (sayı, tarih, dosya adedi) yazma. Yerine onu üreten komutu yaz.
> - Mimari sözleşmeler ve mevcut durum için `CLAUDE.md`.

---

## 1. Doğruluk ve Veri Erişimi

### D1. Pasife alınan daire hiçbir listede görünmüyor 🟡

- **Durum:** Servis katmanı düzeltildi. `getResidentHistory` artık sahiplik kontrolünü dairenin aktifliğine bakmadan yapıyor, yani pasif dairenin sakin geçmişi **endpoint üzerinden erişilebilir**. Kalan eksik arayüzdedir.
- **Kanıt:** `resident/service.js` → `getResidentsOverview` ve `dues/service.js` → `getDuesForMonth` sorgularının ikisi de `WHERE a.building_id = ? AND a.is_active = 1` filtreler. Pasif daireyi listeleyen hiçbir ekran yoktur.
- **Sonuç:** Kullanıcı bir daireyi pasife aldıktan sonra onu hiçbir yerde göremez, dolayısıyla sakin geçmişine ulaşacak bir giriş noktası da yoktur. Veri durur, yol yoktur.
- **Not (öncelik arttı):** `addApartment` bir dönem aynı numaralı pasif satırı diriltiyordu ve bu, farkında olmadan tek geri dönüş yolunu oluşturuyordu. O yol kaldırıldı (`003_apartment_no_unique_active.sql`), çünkü diriltilen satır eski `dues`, ödeme ve sakin geçmişini yeni daireye taşıyordu. Artık pasif daireye giden hiçbir yol yoktur, yani bu maddenin arayüz tarafı tek erişim noktasıdır.
- **Karar gerekiyor:** Pasif daireler nerede görünecek. Seçenekler: Daireler sayfasında "Pasif daireleri göster" anahtarı, ya da ayrı bir arşiv bölümü (binaların arşiv bölümüyle aynı desen). İkisi de yeni UI ve muhtemelen `getResidentsOverview`'a bir bayrak demektir, yani `CLAUDE.md` §3 gereği önce onay alınmalıdır.
- **Doğrulama:** `grep -rn "is_active = 1" electron/modules/resident/service.js electron/modules/dues/service.js`

---

## 2. Ölçek

### S1. `getTransactions` "Tüm Zamanlar" yolunda sınırsız satır döner 🟡

- **Kanıt:** `financial/service.js` → `getTransactions`, `period` `null` geldiğinde `dateFilter` boş string olur ve sorguda hiçbir `LIMIT` yoktur. `incomes` ve `expenses` `UNION ALL` ile birleşip tamamı renderer'a geçer.
- **Neden önemli:** better-sqlite3 senkrondur (`CLAUDE.md` §14), yani büyük sonuç kümesi hem main process'i hem render'ı bloklar. Sayfa varsayılan olarak tek ay çektiği için risk bugün düşüktür, ama "Tüm Zamanlar" seçeneği 2-3 yıllık veride bu yolu açar.
- **Öneri:** `LIMIT/OFFSET` ya da keyset sayfalama. Sorgu üreteci filtreyle birlikte tek yerde kurulmalı, değerler her zaman parametreli kalmalı.
- **Karar gerekiyor:** Sayfa boyutu ve arayüzün nasıl gezineceği (sayfa numaraları mı, "daha fazla yükle" mi). IPC payload'ı değişeceği için `CLAUDE.md` §3 gereği önce onay alınmalıdır.
- **Dosya:** `electron/modules/financial/service.js`, `electron/modules/financial/handlers.js`, `electron/windows/main/preload.js`, `src/pages/Transactions/Transactions.jsx`
- **Doğrulama:** `grep -n "LIMIT" electron/modules/financial/service.js` (çıktı boş)

### S2. Sorgu planları hiç denetlenmedi 🟡

- **Kanıt:** Kod tabanında hiçbir `EXPLAIN QUERY PLAN` kullanımı ya da kaydı yok.
- **Durum:** `incomes` ve `expenses` `(building_id, date)` index'ine ve `is_cancelled = 0` kısmi index'ine sahiptir. `dues`'un `UNIQUE(apartment_id, year, month)` kısıtı, `apartments` üzerinden yapılan join'ler için prefix olarak kullanılabilir durumdadır. Yani bilinen bir index eksiği **yok**, denetlenmemiş olması eksik.
- **Not:** `getTransactions` `is_cancelled` filtresi uygulamadığı için kısmi index'i (`idx_*_active_only`) kullanamaz, yalnızca tam index'i kullanır. Bu bilinçli olabilir (sayfa iptal kayıtlarını da gösterir), ama ölçülmemiştir.
- **Öneri:** S1 ile birlikte kritik sorgulara (`getTransactions`, `getReportData`, `dashboard.getStats`, `ensureMonthlyDues`) `EXPLAIN QUERY PLAN` bak, sonucu bu maddenin yerine yaz.
- **Doğrulama:** `grep -rn "EXPLAIN" electron database` (çıktı boş)

---

## 3. Tekrar ve Tutarlılık

### R1. `calcDueStatus` ile şemadaki CHECK elle senkron tutuluyor 🟡

- **Kanıt:** `dues/service.js` → `calcDueStatus(dueAmount, paidAmount)` ile `database/schema/05_dues.sql` içindeki `status` CHECK ifadesi aynı mantığı iki dilde yazar.
- **Durum:** Bu **bilinçli bir çift yazımdır** ve `CLAUDE.md` §7.2'de belgelidir. CHECK son savunma hattı olduğu için sapma sessiz kalmaz, DB ihlal fırlatır. Yani risk düşüktür, ama sapma ancak çalışma zamanında görünür.
- **Öneri:** Dokunulmayabilir. Ele alınacaksa yol, `status` kolonunu tümden kaldırıp okuma sorgularında `CASE` ile türetmektir. Bu her okuma sorgusunu ve `COALESCE(d.status, 'unpaid')` desenini yeniden yazmayı gerektirir, kazancı bir kolonluk depolamadır. Karşılığı düşük.
- **Doğrulama:** `grep -n "calcDueStatus" electron/modules/dues/service.js` ve `grep -n "status = CASE" database/schema/05_dues.sql`

### R2. Yeniden adlandırılan iki sayfanın iç adları eski kaldı 🟡

- **Kanıt:** Arayüzde `Gelir ve Gider` sayfası `Kasa Defteri`, `Tazminat Kasası` sayfası `Personel` oldu. Değişiklik yalnızca kullanıcıya görünen metindedir. Rotalar (`/transactions`, `/severance-fund`), sayfa klasörleri ve bileşen adları (`Transactions`, `SeveranceFund`, `TransactionsModals/`, `SeveranceFundModals/`), CSS önekleri (`tx-*`, `sf-*`) ve kabuk sınıfları (`.transactions-container`, `.severance-container`) eski adları taşır.
- **Neden önemli:** Kodda sayfayı arayan biri ekrandaki adla bulamaz. `CLAUDE.md` iki adı da anarak bu açığı kapatıyor, ama ikili adlandırma zamanla karışıklık üretir.
- **Öneri:** Rota, klasör, bileşen, CSS öneki ve kabuk sınıfını yeni adlara çevir (ör. `/ledger` + `Ledger` + `lg-*`, `/staff` + `Staff` + `st-*`). Rotaya `navigate` ile giden her yer (Dashboard kartları ve ölçümleri, `Dues` ile `BuildingView`'un kısayolları), `App.jsx`'teki lazy import ve rota, `global.css`'in sayfa kabuğu ile modal animasyonu listeleri ve `CLAUDE.md`'nin ilgili bölümleri birlikte değişir. `severance` IPC domain'i ve `modules/severance/` klasörü tazminat kasasının iş mantığını taşıdığı için yerinde kalabilir.
- **Karar gerekiyor:** Yeni iç adlar. Çok dosyaya dokunan bir refactor olduğu için `CLAUDE.md` §3 gereği önce onay alınmalıdır.
- **Doğrulama:** `grep -rn "/transactions\|/severance-fund" src --include=*.jsx`

---

## 4. Güvenlik Yüzeyi

Üçü de bugün istismar edilebilir bir açık değil. Uygulama offline, tek kullanıcılı ve dışarıdan içerik yüklemiyor.

### V1. Ana pencerede `sandbox:false` 🔴

- **Kanıt:** `electron/windows/main/index.js` → `webPreferences.sandbox: false`.
- **Neden böyle:** Preload CommonJS `require` ile `ipc/channels.js`'i çeker, sandbox açıkken bu mümkün değildir.
- **Öneri:** Preload bundle edilirse (kanal listesi preload dosyasına gömülürse) `sandbox: true`'ya geçilebilir. Bu, `channels.js`'in tek doğruluk kaynağı olma özelliğini korumak için bir build adımı gerektirir, yani yeni bir derleme aşaması demektir. Splash ve kılavuz pencereleri zaten sandbox altındadır.
- **Doğrulama:** `grep -rn "sandbox" electron/windows`

### V2. `index.html` CSP'sinde `style-src 'unsafe-inline'` 🟡

- **Kanıt:** `grep -o "style-src[^;]*" index.html` → `style-src 'self' 'unsafe-inline'`
- **Neden böyle:** SweetAlert2 ve React inline style üretir. Splash ve kılavuz pencerelerinin CSP'si bu izni **taşımaz** (`default-src 'none'` tabanlı), yani sapma yalnızca ana penceredir.
- **Öneri:** Nonce ya da hash tabanlı politikaya geçiş, kullanılan kütüphanelerin inline style üretimi nedeniyle kolay değil. Ölçmeden dokunma, ölçüldüğünde sonucu bu maddenin yerine yaz.
- **Doğrulama:** `grep -o "style-src[^;]*" index.html`

### V3. Renderer hatalarında yapısal stack trace yok 🟡

- **Kanıt:** `electron/errorReporting.js` → `catchRendererConsole`, `console-message` olayından yalnızca `message`, `sourceId` ve `lineNumber` alır.
- **Sonuç:** main.log'a hatanın **metni** düşer, çağrı yığını düşmez. Bir arızanın nerede oluştuğunu göstermeye yetmeyebilir.
- **Öneri:** İhtiyaç doğarsa `main.jsx`'te `window.onerror` + `unhandledrejection` dinlenip kendi IPC kanalımızla main'e gönderilir (4 dosyalık standart endpoint turu, `CLAUDE.md` §3 gereği onay gerekir) ve `catchRendererConsole` silinir. **electron-log'un kendi renderer köprüsü kullanılmamalı**, çünkü `channels.js` whitelist'inin dışında ikinci bir köprü açar ve §2.1/§12'nin tek köprü kuralını deler.
- **Doğrulama:** `grep -n "console-message" electron/errorReporting.js`

---

## 5. Arayüz Borcu

### U1. 1rem okunabilirlik eşiği taşması 🟡

- **Kural:** `CLAUDE.md` §11, gövde/etiket/giriş alanı/buton/tablo metni için alt sınırı 1rem koyar. Rozet metinleri ve floating-label'ın küçülmüş hâli bu sınırdan muaftır.
- **Ölçüm komutu:** `grep -rEc "font-size:\s*0\.[0-9]+rem" src --include=*.css | grep -v ":0$" | sort -t: -k2 -rn`
- **Muaf olanlar (düzeltme gerekmez):** `AuthField.css` (floated etiket ve Caps Lock rozeti) ile `global.css` (sürüm rozeti). İkisinde çıkan sonuçlar belgeli istisnalardır.
- **Gerçek borç:** Kalan sayfa CSS dosyaları. Yoğunlukları yukarıdaki komutla ölçülür, sayı buraya yazılmaz.
- **Kural:** **Toplu sweep yapma.** Yoğun tablo sayfalarında satır yüksekliği ve sütun genişliği değişir, her sayfa iki temada gözle doğrulanmalıdır. Bir sayfaya dokunulduğunda o sayfa yükseltilir.

### U2. SweetAlert diyaloglarının modale taşınması 🔴

- **Karar:** Kullanıcı isteğiyle, form taşıyan diyalogların çoğu sayfa modallerine (`<Sayfa>Modals/`) taşınacak. İlk adım atıldı: şifre değiştirme ve hesap devri `ProfileModals/` altındadır.
- **Neden:** SweetAlert girdi kutuları oturum ekranlarının alan dilini (`AuthField`, Caps Lock rozeti, göster/gizle, alan içi hata) taşımıyor. Birden fazla alan gerektiren akışlar da art arda diyaloglara bölünüyor, kullanıcı bir adımda vazgeçince önceki girdiler kayboluyor.
- **Adaylar:** `showDialog.prompt` (e-posta), `showDialog.passwordPrompt` (kurtarma kodu üretimi) ve `showDialog.cancelReason` (ödeme, gelir ve gider iptali) çağrıları.
- **Karar gerekiyor:** Hangi diyaloglar SweetAlert'te kalacak. Öneri: `toast`, `confirm`/`confirmDanger`, `error` ve bir kez gösterilen kod diyalogları (`codeDialog`) kalır, çünkü form taşımazlar. Taşıma bittiğinde `dialog.js`'ten kullanılmayan metodlar silinir ve `CLAUDE.md` §11'in dialog bölümü güncellenir.
- **Doğrulama:** `grep -rn "showDialog\.\(prompt\|passwordPrompt\|cancelReason\)" src`

### U3. Binanın adresi tutulmuyor, belgelerde adres satırı yok 🟡

- **Kanıt:** `buildings` tablosunda adres kolonu yok (`database/schema/02_buildings.sql`). Tahsilat makbuzu ile gider pusulasının başlığı (`src/pages/Transactions/TransactionsPdf/TransactionDocument.jsx` → `Header`) bu yüzden yalnızca bina adını ve `YÖNETİMİ` satırını basar.
- **Hedef:** Kâğıt makbuzlarda başlığın altında apartmanın açık adresi durur. Adres tutulmaya başladığında `Header` bileşeninin kutusuna `YÖNETİMİ` satırının altında bir adres satırı eklenir, iki belge de aynı bileşeni kullandığı için tek yerde değişir. Kutu 22mm yüksekliğindedir, adres satırı eklenirken belgelerin tek sayfaya sığdığı yeniden ölçülmelidir.
- **Karar gerekiyor:** Adresin nerede girileceği (bina kurulum sihirbazı, `SelectBuilding`'in yeniden adlandırma formu ya da ayrı bir bina bilgileri ekranı) ve zorunlu olup olmadığı. Şema ile `building` IPC'si değişeceği için `CLAUDE.md` §3 gereği önce onay alınmalıdır.
- **Doğrulama:** `grep -n "address" database/schema/02_buildings.sql` (çıktı boş)

### U4. Binanın açılış kasası tutulmuyor 🟡

- **Kanıt:** `buildings` tablosunda başlangıç bakiyesi kolonu yok (`database/schema/02_buildings.sql`). `report/service.js` → `getReportData` devreden kasayı (`openingBalance`) yalnızca aralıktan önceki iptalsiz gelir eksi giderden hesaplar, yani defterin ilk gününden önce var olan para hiçbir yerde durmaz.
- **Sonuç:** Yönetimi devralan ya da defteri yıl ortasında açan kullanıcı kasadaki mevcut parayı giremez. Bugünkü tek yol, tutarı `Diğer` kategorisiyle bir gelir satırı olarak yazmaktır, o da kasa hareketleri listesinde gerçek bir tahsilat gibi görünür.
- **Hedef:** Para binanın kendi alanı olsun, gelir kategorisi değil. Gelir kategorisi seçeneği tartışıldı ve seçilmedi: altı yuvadan birini yerdi ve o satıra makbuz kesilebilir olurdu (`CLAUDE.md` §11).
- **Karar gerekiyor:** Değerin nerede girileceği (bina kurulum sihirbazının bir adımı ya da bina bilgileri ekranı), hangi tarihten itibaren geçerli sayılacağı ve raporun `all` kapsamında nasıl görüneceği (`openingBalance` o kapsamda bugün `null`'dur). Şema, `building` IPC'si ve rapor sözleşmesi değişeceği için `CLAUDE.md` §3 gereği önce onay alınmalıdır.
- **Doğrulama:** `grep -n "opening" database/schema/02_buildings.sql` (çıktı boş)

---

## 6. Bilinçli Kararlar (dokunma)

Bunlar borç gibi görünür ama karar verilmiştir. Yeniden tartışmadan önce somut bir gerekçe gerekir.

| Konu                                 | Durum                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Para `REAL` saklanıyor               | TL defteri, tek kullanıcı. Kuruş hassasiyeti `ROUND` ve `toFixed(2)` ile yönetilir. Şikâyet gelirse kuruş-integer migration'ı planlanır, şimdilik dokunma             |
| Otomatik test yok                    | Doğrulama elle yapılır (`npm run dev` + `npm run lint`). Kullanıcı tercihi                                                                                            |
| Global state kütüphanesi yok         | Sayfa başına lokal state yeterli. Bağımlılık maliyeti fayda getirmiyor                                                                                                |
| Prop doğrulaması yok                 | React 19 `propTypes` denetimini paketten çıkardı, tanımlar sessizce yok sayılıyordu. Yeni bileşene ekleme                                                             |
| Kalıcı oturum yok                    | Oturum `sessionStorage`'dadır ve uygulama kapanınca ölür. Tek kullanıcılı offline bir uygulamada kalıcı oturum şifre korumasını fiilen devre dışı bırakır             |
| Yakalanmamış hatada süreç kapanmıyor | `onError` içinde `app.quit()` çağırmak, zararsız bir hatada kullanıcının yarım kalan form girişini keser. Kutu tek seferliktir (`fatalErrorShown`), ekran kilitlenmez |
| Enum listeleri iki süreçte ayrı      | Main CommonJS, renderer ESM, aralarında yalnızca IPC var. Ortaklaştırılamaz. Parite `CLAUDE.md` §9'daki kuralla korunur                                               |
| Bağımlılık eklemeden çöz             | Yeni paket eklemeden önce mevcut yığınla çözülüp çözülemeyeceğine bak. Paketin boyut, yükseltme ve güvenlik bakım maliyeti, kazandırdığı işlevden büyük olmamalı      |

**Eklenmeyecekler:** bildirim ya da e-posta gönderimi (offline ilkesine aykırı), çevrimiçi senkron ve çoklu cihaz (sunucusuz mimari temel karardır), plugin mimarisi (tek geliştirici ve kapalı kapsam için aşırı mühendislik).

---

## 7. Toplu Doğrulama

Bu dosyadaki ölçümleri yeniden üretir:

```bash
npx eslint . && grep -rn "EXPLAIN\|LIMIT" electron/modules/financial/service.js; grep -o "style-src[^;]*" index.html; grep -rEc "font-size:\s*0\.[0-9]+rem" src --include=*.css | grep -v ":0$"
```

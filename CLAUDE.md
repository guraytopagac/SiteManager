# Mavikent Site Yönetimi Uygulaması: Teknik Referans

> **Ne olduğu:** Bu dosya projenin haritasıdır. Mimari, sözleşmeler ve kurallar burada durur.
> **Otorite koddadır.** Bir davranış dokümanla çelişirse doğru olan koddur, düzeltilecek olan dokümandır.
> **Nereden başlanır:** Yeni görevde önce §17 (Hızlı Rehber) okunur, oradan ilgili bölüme geçilir. Baştan sona okumak gerekmez.
> **Gelecek hedefler ve teknik borç burada değil, `ROADMAP.md`'dedir.** Tamamlanan madde oradan silinir.
>
> **Yaşayan doküman kuralı.** Mimari, şema, IPC ya da iş kuralı değiştiren her değişiklik aynı commit'te bu dosyayı da günceller.
>
> **Bayatlayan değer yazma.** Sürüm numarası, dosya sayısı, ihlal sayısı, tarih gibi kendiliğinden eskiyen veriler buraya yazılmaz. Yerine tek doğruluk kaynağı (`package.json` → `version`) ya da onu üreten komut yazılır.

---

## 0. Okunmayacak Dosya ve Klasörler

`.gitignore`'daki her şey okunmaz. Liste orada tutulur, buraya kopyalanmaz. `Grep` ripgrep tabanlıdır ve `.gitignore`'a zaten uyar, yani bu kural asıl olarak dosya **okuma** ve dizin listeleme için geçerlidir.

Ayrıca okunmaz (`.gitignore`'da değildirler, ayrı gerekçeleri vardır):

| Yol                  | Neden                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| `package-lock.json`  | Çözülmüş bağımlılık ağacı. Sürüm sorusunun cevabı `package.json`'dadır |
| `assets/`            | İkili varlıklar. Dosya adı bilgi verir, içeriği vermez                 |

**İstisna:** `%APPDATA%/mavikent-site-yonetimi/logs/main.log` okunur ve arıza teşhisinde okunmalıdır (§13). `.gitignore`'daki `*.log` deseni repo içindeki logları kapsar, çalışma zamanı log dosyasını değil.

---

## 1. Proje Genel Bakış

**Tür:** Electron + React masaüstü uygulaması. Yalnızca Windows hedeflenir, NSIS installer ile dağıtılır.
**Amaç:** Apartman yöneticilerinin aidat, gelir/gider, daire/sakin ve raporlama işlerini tek uygulamadan, **tamamen offline** yönetmesi. Sunucu yoktur, tüm veri lokal SQLite dosyasındadır.

**Temel varsayımlar.** Tasarım kararlarının çoğu bunlardan türer, bir çözüm önermeden önce bunlara uyduğunu doğrula:

| Varsayım                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ |
| **Tek bilgisayar.** Senkronizasyon yoktur, veri `%APPDATA%` altındadır, makineler arası tek taşıma yolu yedek dosyasıdır |
| **Tek hesap, rol yok.** Bir makinede bir kullanıcı vardır, admin/manager ayrımı yoktur                                   |
| **Bir hesap N bina (defter).** Veri izolasyonu `building_id` ile sağlanır, binalar arası ortak rapor yoktur              |
| **Hedef kitle 40+ apartman yöneticisi.** Okunabilirlik alt sınırı ve Türkçe kullanıcı metni bundan gelir                 |

**Teknik yığın.** Sürüm numarası yazılmaz, tek doğruluk kaynağı `package.json`'dır:

| Katman            | Teknoloji                                                             |
| ----------------- | --------------------------------------------------------------------- |
| Masaüstü kabuk    | Electron (CommonJS)                                                   |
| UI                | React + react-router-dom (HashRouter), Vite                           |
| İkon              | `react-icons`, **yalnızca `fi` (Feather) seti**. İkinci set açma      |
| Veritabanı        | SQLite via `better-sqlite3` (senkron, main process'te)                |
| Şifreleme         | `bcryptjs` (şifre + kurtarma kodu hash'leri, 12 tur)                  |
| Dialog (renderer) | SweetAlert2, yalnızca `src/utils/alert.js` sarmalayıcısı üzerinden    |
| PDF               | `jspdf` + `jspdf-autotable`, renderer'da üretilir, main'de kaydedilir |
| Güncelleme        | `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`)     |
| Loglama           | `electron-log` (main process)                                         |
| Prod statik sunum | `electron-serve`, `dist/` klasörünü `app://` üzerinden yükler         |
| Paketleme         | `electron-builder` (NSIS installer → `dist_electron/`, §15)           |
| Biçim + lint      | Prettier (caret'siz pinli) + ESLint (§3)                              |
| Test              | Yok. Doğrulama elle yapılır (`npm run dev` + `npm run lint`)          |

---

## 2. Mimari

### 2.1 Process Modeli

```
┌──────────────────────────  Main Process (Node.js)  ──────────────────────────┐
│ electron/main.js                →  app lifecycle + açılış sırası (§2.2)      │
│ electron/modules/*/handlers.js  →  IPC giriş noktası + validasyon            │
│ electron/modules/*/service.js   →  iş mantığı + SQL (better-sqlite3)         │
│ electron/windows/*/index.js     →  pencere ömrü: main · splash · guide       │
│ database/db.js                  →  tek DB bağlantısı, WAL (open/get/closeDb) │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │  invoke / handle   renderer → main, istek-cevap
                               │  webContents.send  main → renderer (EVENTS, splash:*)
                               │  ipcRenderer.send  renderer → main, cevapsız
┌──────────────────────────────┴───────────────────────────────────────────────┐
│ electron/preload.js             →  `electronAPI` + kanal whitelist (§9)      │
│ windows/splash/preload.js       →  `splashAPI`, yalnızca `splash:*`          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Renderer'lar (üçü de nodeIntegration:false, contextIsolation:true):          │
│   Ana pencere   →  React (`src/`), yalnızca `window.electronAPI.*`           │
│   Splash        →  saf HTML/JS, kendi preload'u (`splashAPI`)                │
│   Kılavuz       →  saf HTML/JS, preload YOK                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Neden DB main'de:** better-sqlite3 senkron ve native olduğu için yalnızca main process'te çalışır.
**Neden köprü bu kadar dar:** Renderer'ın Node'a, dosya sistemine ve DB'ye hiçbir erişimi yoktur. Tek yol preload'un whitelist'lediği kanallardır, yani yeni bir yetenek ancak `channels.js` + `preload.js` çiftine yazılarak açılır (§12).

### 2.2 Açılış Sırası (`electron/main.js`)

Sıra **kritiktir**, değiştirme.

| #   | Adım                                                                       | Nerede                       | Splash mesajı                    |
| --- | -------------------------------------------------------------------------- | ---------------------------- | -------------------------------- |
| 1   | `initLogging(getMainWindow)`, ardından `app.disableHardwareAcceleration()` | Modül gövdesi, kilitten önce | (pencere yok)                    |
| 2   | `app.requestSingleInstanceLock()`, kilit alınamazsa yalnızca `app.quit()`  | Modül gövdesi                | (pencere yok)                    |
| 3   | `app.whenReady` → `startApp()` → `connectDatabase()`                       | `else` dalı                  | (pencere yok)                    |
| 4   | `createSplashWindow()` + `await waitForSplashReady()`                      | `startApp` try/catch         | (ilk boyama)                     |
| 5   | **Yalnızca paketli sürümde** `runStartupUpdateFlow()`                      | `startApp` try/catch         | "Güncellemeler kontrol ediliyor" |
| 6   | `runMigrations(db)`                                                        | `startApp` try/catch         | "Veriler hazırlanıyor"           |
| 7   | `registerIpcHandlers(ipcMain)`                                             | `startApp` try/catch         | (6 ile aynı faz)                 |
| 8   | `createMainWindow(isDev)` + `closeSplashWhenMainReady(...)`                | `startApp` try/catch         | "Uygulama yükleniyor"            |

4-8 arasındaki her hata "Başlatma Hatası" kutusu ve `app.quit()` ile biter.

#### Değiştirilemez kısıtlar

- **Tek instance kilidi tüm açılışı kapsar.** `initLogging` kilitten öncedir (ikinci instance da loglar), ama kilidi alamayan süreç yalnızca `app.quit()` çağırır ve hiçbir açılış adımına girmez. Aksi hâlde quit tamamlanmadan `ready` gerçekleşirse aynı DB dosyasına ikinci bağlantı açılır ve migration ikinci kez çalışıp SQLITE_BUSY üretebilir. `second-instance` olayında mevcut pencere öne getirilir, ana pencere yoksa splash.
- **DB bağlantısı yalnızca adım 3'te açılır.** `connectDatabase()` `openDatabase()`'i çağırır, hata durumunda kutuyu gösterip `null` döner ve `startApp` çıkar.
- **Güncelleme kontrolü migration'lardan ÖNCE çalışır**, bozuk migration içeren bir sürüm güncellemeyle kurtarılabilsin diye.
- **`require("./windows/main")` dosya başında kalmak zorundadır.** Modül gövdesinde `electron-serve`'ün `serve()` fonksiyonu çağrılır ve paket şemayı bir microtask içinde `protocol.registerSchemesAsPrivileged` ile kaydeder. Ready sonrası çağrılırsa `"A new scheme cannot be registered after app is ready"` fırlatır ve hata **yalnızca paketli sürümde** görünür. Diğer tüm require'lar serbesttir ve dosya başındadır, çünkü service'ler `getDb` fonksiyonunu alır ve modülü require etmek bağlantı açmaz.
- **Splash'in kapanış koreografisinin tamamı `windows/splash/index.js`'tedir**, main.js yalnızca tetikler. `ready-to-show` beklenir, dev'de `DEV_LINGER_MS` kadar bekletilir, güvenlik ağı olarak `MAIN_WINDOW_READY_TIMEOUT_MS` içinde olay gelmezse splash yine kapatılır ve durum `main.log`'a yazılır. Aksi hâlde renderer yüklenemediğinde kullanıcı donmuş bir splash görür.
- **`window-all-closed` dinleyicisi yoktur (bilinçli).** Electron, olaya abone olunmadığında macOS dışındaki platformlarda uygulamayı zaten kapatır. DB kapatma bu olaya değil `will-quit`'e bağlıdır (§7.1).
- **Açılışta hesap satırı seed edilmez.** Hiç hesap yokken uygulama açılır, renderer `getSetupState` ile `needsSetup:true` alır ve `/setup`'a yönlenir. Gerçek `users` satırı yalnızca `completeSetup` içinde oluşur.

### 2.3 Pencereler (`electron/windows/`)

| Pencere | Modül                   | Preload                     | `sandbox`  | Ne zaman açılır    |
| ------- | ----------------------- | --------------------------- | ---------- | ------------------ |
| Ana     | `windows/main/index.js` | `electron/preload.js`       | `false`    | Açılış adım 8      |
| Splash  | `windows/splash/`       | `windows/splash/preload.js` | `true`     | Açılış adım 4      |
| Kılavuz | `windows/guide/`        | yok                         | varsayılan | Yardım menüsü (F1) |

**Ana pencere.** Dev'de `http://localhost:5173/`, prod'da `electron-serve` ile `dist/`. `webPreferences`: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:false` (preload'un `require` yapabilmesi için), `webSecurity:true`. Ölçüler `1200x800`, minimum `1140x720`, ikisi de `screen.getPrimaryDisplay().workAreaSize` ile kısıtlanır. Pencere her açılışta `maximize()` edilir, yani bu ölçüler fiilen "restore" boyutudur. `maximize` + `show` ikilisi bu modülde değil splash modülünün `closeSplashAndShowMain`'indedir, çünkü gösterme anının sahibi splash'tir. Uygulama menüsünü kuran tek yer burasıdır. Pencereye `title` verilmez, başlık `index.html`'de tanımlıdır. Yükleme çağrısının promise'i `.catch(() => {})` ile kapatılır, çünkü hata zaten `did-fail-load` dinleyicisinde loglanır ve yakalanmazsa aynı hata bir de sahipsiz reddedilme olarak düşer.

**Splash.** Açılış ekranı, kendi minimal preload'u vardır (`splash:*` kanalları). Sürüm, güncelleme durumu ve indirme yüzdesini gösterir. Güncelleme indikten sonra "Şimdi Yeniden Başlat / Daha Sonra" kararını da bu pencere sorar (`askToRestart` splash'e bağlıdır ve pencere kapatılırsa `false` döner).

- Splash'in tüm ömrü bu modüldedir: açma, `waitForSplashReady`, durum mesajları ve `closeSplashWhenMainReady`.
- `waitForSplashReady` renderer ile el sıkışmaz, `webContents`'in `did-finish-load` olayını `SPLASH_READY_TIMEOUT_MS`'lik bir ağla bekler. Gate gereklidir: renderer dinleyicilerini kurmadan gönderilen `webContents.send` sessizce düşer.
- Sürüm IPC ile değil query string ile geçirilir (`loadFile(..., { query: { v } })`), böylece ilk boyamada görünür.
- Durum mesajları `setSplashStatus(text, isError)` ile yazılır, görev çubuğu ilerlemesi `setSplashProgress(value, options)` ile. Pencere nesnesine dokunan tek yer splash modülüdür, dışarıdan `getSplashWindow().setProgressBar(...)` çağrılmaz. Ham `sendToSplash` dışa açıktır, çünkü `autoUpdater` diğer `splash:*` kanallarını doğrudan kullanır.
- `CLOSE_FADE_MS` sabiti `splash.css`'teki `body` geçiş süresiyle **elle** eşlenir. Biri değişirse diğeri de değişmelidir.

**Kılavuz.** Kullanım kılavuzu penceresi (saf HTML+CSS+JS), menüden ya da F1 ile açılır. Preload'u yoktur. Pencere tekildir: açık bir kılavuz varken ikincisi oluşturulmaz, mevcut pencere restore edilip odaklanır. Sürüm, destek adresi ve tema query string ile geçirilir. `openGuide` ana pencerenin `data-theme` değerini `executeJavaScript` ile okur ve `backgroundColor`'ı ona göre seçer. Menüdeki "Tema Değiştir" ana pencereye `EVENTS.TOGGLE_THEME` gönderdikten sonra `toggleGuideTheme()` çağırır. Sayfa içi olmayan bağlantılar `will-navigate` yakalanıp `shell.openExternal`'a devredilir, aksi hâlde `mailto:` bağlantısı hiçbir şey yapmaz.

---

## 3. Kod Yazma Kuralları

- **Dil:** UI metinleri ve kullanıcıya dönen hata mesajları **Türkçe**, kod ve yorumlar **İngilizce**. Commit başlıkları Türkçe gelenektir.
- **Stil:** Prettier. `.prettierrc` iki alan taşır: `printWidth: 120` ve `endOfLine: "auto"`. İkincisi zorunludur, çünkü Windows'ta çalışma kopyası CRLF, repo LF'tir ve varsayılan `"lf"` gerçek sapmayı satır sonu gürültüsünün altında gizler. Kalan sapma **toplu düzeltilmez**: dokunulan dosya o değişiklikle birlikte biçimlendirilir. Güncel sapma listesi için `npx prettier --list-different "src/**/*.{js,jsx,css}"`, sayıyı buraya yazma.
- **Lint:** ESLint (`eslint.config.mjs`), `npm run lint`. Üç kural bilinmeli: (a) `no-console` yalnızca `console.error` ve `console.warn`'a izin verir, bu yüzden bilgi amaçlı log satırları da `warn`'dır, (b) `no-unused-vars` **hata** seviyesindedir ve yalnızca `^_` ile başlayan argümanları muaf tutar, (c) **dört ayrı globals bölgesi vardır**: `src/**` browser, `electron/**` + `database/**` Node, `guide.js` + `splash.js` + `public/*.js` yeniden browser, kökteki config dosyaları (`*.js`, `*.mjs`) Node. Yeni bir pencere renderer script'i eklenirse üçüncü bölgeye de yazılmalıdır, aksi hâlde Node globals altında lint edilip `document` için hata verir. Dördüncü bölge olmadan kök config dosyaları hiçbir bloğa uymaz ve **tek kural bile uygulanmadan** lint edilmiş sayılır, doğrulaması `npx eslint --print-config vite.config.js` çıktısındaki `rules` alanıdır.
- **Naming:** değişkenler `camelCase`, React bileşenleri `PascalCase`, sabitler `UPPER_SNAKE_CASE`, IPC kanal string'leri `domain:kebab-case`.
- **Modül sistemi:** `electron/` ve `database/` CommonJS (`require`), `src/` ESM (`import`). Karıştırma.
- **Import sırası** (CommonJS dosyalarda): 1) Node builtin, 2) external paketler, 3) local. Her grup kendi içinde alfabetik.
- **Import alias:** `src/` içinde `@` → `src/` alias'ı tanımlıdır (`vite.config.js`). Yeni bileşenlerde `@/hooks/...` biçimi tercih edilir, eski dosyalardaki göreli yollar toplu dönüştürülmez.
- **Prop doğrulaması yoktur** (TypeScript de yok, `prop-types` de yok). React 19 `propTypes` denetimini paketten çıkardı, tanımlar sessizce yok sayılıyordu. Yeni bileşene `propTypes` **ekleme**, prop sözleşmesini destructuring imzasından ve varsayılan değerlerden okunur tut.
- **Yorumlar.** Açıklama yorumu `//` ile ve İngilizce yazılır, kodun **ne yaptığını değil neden öyle olduğunu** anlatır. Desen şudur: dosyanın başında modülün ne olduğunu söyleyen bir ya da iki satır, gövdede yalnızca kolay yanlış anlaşılan kararların gerekçesi. Kendini anlatan satırın üstüne yorum konmaz. Bugün yorum taşıyan yer `electron/`, `database/` ve kökteki config dosyalarıdır, `src/` henüz bu turdan geçmedi ve orada yorum yoktur. Mimariyi ilgilendiren gerekçenin yeri yine bu dokümandır, yorum yalnızca yerel kararın yanında durur.

### Önce Sor: Tasarım Kararları

Planı sun, onay al, sonra yaz:

- Mimari değişiklikler (klasör yapısı, yeni bağımlılık)
- 3+ dosya etkileyen refactor
- Veritabanı şeması değişikliği
- IPC endpoint ekleme ya da değiştirme
- 100+ satır silme

### Önce Sor: Dışa Dönük ve Geri Alınamaz Eylemler

- `git commit` / `git push`
- `gh release create` / `gh release edit`
- `npm run dist` ya da `npm run build`

### Asla Yapma

- `.env` oluşturma ya da API anahtarı/şifre ekleme
- Kullanıcıya sormadan bağımlılık yükseltme
- Renderer'a Node API açma (preload whitelist dışına çıkma)
- `dues` / `due_payments` / `incomes` / `expenses` kayıtlarını fiziksel silme (§8)

---

## 4. Klasör Yapısı

```
SiteManager/
├── assets/              # icon.ico, logo, giriş ekranı arka planları
├── public/              # Vite'ın olduğu gibi kopyaladığı statikler. Bugün tek dosya:
│                        #   theme-init.js, ilk boyamadan önce çalışan tema script'i (§11)
├── database/
│   ├── schema/          # NN_tablo.sql, alfabetik yüklenir, CREATE ... IF NOT EXISTS.
│   │                    #   Numaralandırma FK bağımlılık sırasını izler: referans verilen
│   │                    #   tablo, kendisine referans verenden önce gelir
│   ├── migrations/      # NNN_english_description.sql, bir kez çalışır. Dosya adı İngilizcedir
│   ├── db.js            # openDatabase() / getDb() / closeDb(). Require etmek bağlantı AÇMAZ
│   └── migrate.js       # runMigrations(db) → önce migrations, sonra schema
│
├── electron/
│   ├── ipc/
│   │   ├── channels.js  # Ana pencerenin kanal sabitleri. Handler'lar VE preload buradan
│   │   │                #   import eder. Splash'in `splash:*` kanalları burada DEĞİLDİR
│   │   ├── handler.js   # createHandle(ipcMain, domain) → handle(...). IPC altyapısıdır,
│   │   │                #   domaine bakmaz, bu yüzden modules/shared'da değil burada durur
│   │   └── index.js     # registerIpcHandlers, tek `registrars` dizisi
│   ├── modules/         # Domain başına handler (validasyon) + service (SQL) çifti
│   │   ├── apartment/   ├── auth/      ├── backup/   ├── building/  ├── dashboard/
│   │   ├── dues/        ├── financial/ ├── report/    ├── resident/
│   │   ├── system/handlers.js   # Servisi yok, yalnızca app version döner
│   │   └── shared/
│   │       ├── dbError.js       # createDbErrorResolver(columnLabels) → resolveDbError
│   │       ├── validate.js      # Ortak doğrulama: fail / noValidation / validatePayload /
│   │       │                    #   validateId / validateBuildingScope / validateCancelReason /
│   │       │                    #   validatePeriod
│   │       │                    #   + paylaşılan yüklemler (isValidDate, isValidYear,
│   │       │                    #   isValidMonth, isValidEmail) ve sınır sabitleri
│   │       ├── duesAccrual.js   # ensureMonthlyDues(buildingId)
│   │       └── trTime.js        # trToday / trYearMonth / monthBounds / toPeriod / currentPeriod
│   │                            #   + createdPeriodSql(alias) ve TR_NOW_SQL sabiti
│   ├── autoUpdater.js   # Güncelleme akışlarının tek sahibi (§15)
│   ├── errorReporting.js # initLogging / showFatalError / SUPPORT_EMAIL (§13)
│   ├── windows/         # main/ · splash/ · guide/
│   ├── main.js          # App lifecycle, bkz. §2.2
│   ├── menu.js          # Menü yapısı + tetikleme. İş mantığı sahibi modüldedir
│   └── preload.js       # contextBridge, safeInvoke/safeOn ile kanal whitelist
│
└── src/
    ├── components/      # AccountMenu, Footer, ErrorBoundary, PageLoader, ProtectedRoute,
    │                    #   CapsLockIndicator, FormField, PasswordStrength
    ├── hooks/           # useTheme, useCurrentUser, useCurrentBuilding, useCapsLockOn, useNeedsSetup
    ├── pages/           # Her sayfa kendi klasöründe (JSX + CSS), App.jsx'te lazy-load
    ├── utils/           # alert.js, date.js, currency.js, passwordStrength.js, releaseNotes.js
    ├── App.jsx          # Rotalar + StartupRedirect + RequireBuilding
    ├── main.jsx         # React mount
    └── style.css        # Global stiller, light/dark tema CSS değişkenleri
```

**Apartments klasörü** tek sayfadır: `Apartments.jsx` hem aidat/daire listesini hem tüm daire işlemlerini (tahsilat, düzenleme, pasife alma, toplu aidat) barındırır. Ortak parçalar `components/`, sabitler `constants.js`, aidat veri çekme mantığı `useDues.js` hook'undadır.

---

## 5. IPC Mimarisi

### 5.1 Akış (örnek: `recordPayment`)

```
Renderer: window.electronAPI.recordPayment({...})
  → preload.js safeInvoke(CH.DUES.RECORD_PAYMENT, payload)   # invoke kanal whitelist'i
  → ipcMain.handle (electron/modules/dues/handlers.js)        # createHandle zarfı, event yutulur
  →   zarfın çağırdığı validate(payload)                      # alan varlığı, aralık, enum, regex
  → dues/service.js                                           # transaction içinde SQL
  → dönüş: { success: true, ...data } | { success: false, message: "Türkçe mesaj" }
```

### 5.2 Kurallar

**1. Kanal string'leri yalnızca `electron/ipc/channels.js`'te tanımlanır.** Handler ve preload aynı sabiti import eder, `channels.js` duplicate değerde açılışta hata fırlatır. Modül named export verir: `{ CHANNELS, EVENT_CHANNELS, INVOKE_CHANNELS }`. Tüketiciler `const { CHANNELS: CH } = require(...)` yazar. Son iki alan `CHANNELS`'tan türetilir ve yalnızca preload kullanır. Domain grupları hem `channels.js`'te hem `preload.js`'te **alfabetik** sıradadır. Grup içi üye sırasının sahibi `channels.js`'tir, `preload.js` ve `handlers.js` o sırayı izler. Grup adı, kanal prefiksi ve modül klasörü aynı kelimedir (`REPORT` → `report:get-data` → `modules/report/`).

**2. Yeni endpoint eklerken 4 dosya değişir:** `channels.js` (sabit) → `modules/<domain>/handlers.js` (validasyon) → `modules/<domain>/service.js` (SQL) → `preload.js` (electronAPI metodu). Yeni domain ise `ipc/index.js`'teki `registrars` dizisine bir satır ekle. §10 tablosunu da güncelle.

**3. Handler deseni.** Her handler `createHandle(ipcMain, "<domain>")` ile üretilen `handle(channel, validate, run, errorMessage?)` ile kaydedilir. Zarf Electron'un `event` argümanını yutar, `run`'ın sonucunu olduğu gibi döndürür, beklenmeyen throw/reject'i yakalayıp `console.error("[<domain>.handlers] <channel>:", err)` loglar ve jenerik `errorMessage` (varsayılan `"İşlem sırasında bir hata oluştu."`) döner. **Handler içinde elle try/catch yazma**, özel mesaj gerekiyorsa 4. parametreyle geç (ör. `report:save-file` → `"Dosya kaydedilemedi."`). Kanal adı böylece **bir kez** yazılır.

`run` her zaman service'ten gelmez. İşin gövdesinde SQL yoksa ve yapılan şey bir Electron/Node API çağrısıysa fonksiyon handler dosyasında kalır. Bugün tek örnek `report:save-file`'dır (`dialog.showSaveDialog` + `fs.promises.writeFile`). **Dialog ana pencereye bağlanır** (`getMainWindow()` ilk argüman), aksi hâlde Windows'ta pencerenin arkasına düşebilir. `backup` da üç dialogunu aynı şekilde bağlar. Ayrım "handler ince, service kalın" değil, **veritabanına dokunan kod service'tedir**. `backup` bunun karşı örneğidir ve service'tedir, çünkü `getDb().backup()` ve `closeDb()` çağırır.

Payload almayan endpoint'ler (`auth:get-setup-state`, `backup:run`) `validate` yerine `noValidation` geçer. **Tek istisna `system`**, ham sürüm string'i döndürdüğü için `ipcMain.handle`'ı doğrudan çağırır.

**4. Doğrulayıcı sözleşmesi.** Her doğrulayıcı **hata nesnesi (`{success:false, message}`) ya da `null`** döner ve parçalar `??` ile zincirlenir. Tüm handler dosyaları aynı iskelettedir:

```js
handle(CH.X.Y, (payload) => validateBuildingScope(payload) ?? validateXFields(payload), service.y);
```

- **Kapsam doğrulayıcısı** ne kapsadığıyla adlandırılır (`validateBuildingScope`, `validateApartmentScope`, `validateResidentScope`, `validateAccountScope`, `validateOwnerScope`, `validateOwnedBuildingScope`, `validateOwnedApartmentScope`) ve `validatePayload` + kimlik kontrollerini `??` ile kurar. **Aynı ad iki modülde farklı bir kimlik alanı doğrulamaz:** `validateApartmentScope` (`resident`) `apartmentId`'yi, `validateOwnedApartmentScope` (`apartment`) `id`'yi doğrular, bu yüzden adları da ayrıdır. `validateBuildingScope` (`validatePayload` + `buildingId`) altı modülde ortaktır, bu yüzden `shared/validate.js`'tedir. Domain kendi kimliğini onun üstüne zincirler, yani bina kimliği her zaman domain kimliğinden önce doğrulanır.
- **Alan doğrulayıcısı** (`validateXFields`) trim/normalizasyonu kendi ilk satırlarında yapar, böylece kapsamın arkasına `??` ile eklenebilir. `const error = ...; if (error) return error;` kalıbı yazılmaz.
- **Kanal başına `validateXPayload` sarmalayıcısı yazılmaz.** Bileşim `handle(...)` çağrısında satır içindedir, tek parça yetiyorsa doğrulayıcı doğrudan geçilir (`handle(CH.DASHBOARD.GET_STATS, validateBuildingScope, ...)`).
- Birden fazla kanalda geçen alan kontrolü ayrı parçaya çıkarılır (`validateDueAmount`, `validatePassword`, `validateRequiredPassword`). Parça birden fazla **domain**'de geçiyorsa `shared/validate.js`'e taşınır: `validateCancelReason` böyle taşındı (`dues` + `financial`), `validatePeriod` de öyle (`dues` + `report`).

`??` sağ tarafı tembel değerlendirdiği için ilk kontrol (payload gerçekten nesne mi) sonrakileri korur. Ortak parçalar `shared/validate.js`'tedir, alan bazlı kontroller domain'in kendi dosyasında kalır.

**Aralık sabiti kuralı:** sayı hemen yanındaki mesajda da yazılıysa (`"... 50.000₺'yi geçemez"`) kontrolde **literal** kullanılır, ayrı `MAX_*` sabiti tanımlanmaz. Mesajda geçmeyen sınırlar (yıl aralığı, tarih aralığı, regex, enum dizisi) adlandırılmış sabit kalır.

**Birden fazla domain'de geçen sınır `shared/validate.js`'e taşınır.** Yıl aralığı (2000-2100), tarih aralığı (`2000-01-01`..`2100-12-31`), ISO tarih biçimi ve e-posta biçimi orada tek kez tanımlıdır ve yüklem olarak dışa açılır: `isValidDate` (biçim, takvim geçerliliği **ve** aralık, üçü tek yüklemdedir çünkü hiçbir çağıran bunları ayrı mesajlarla anlatmaz), `isValidYear`, `isValidMonth`, `isValidEmail` (tip + 5-254 uzunluk + biçim). Sınır sabitleri (`MIN_DATE`, `MAX_DATE`, `MIN_EMAIL_LENGTH`, `MAX_EMAIL_LENGTH`) yükleme gömülüdür ve dışa açılmaz. Bu dosya sınırlar için **yüklem** verir, **mesaj** vermez (mesaj üreten üyeler sayılıdır: kimlik ve kapsam doğrulayıcıları `validatePayload`, `validateId`, `validateBuildingScope` ile birden fazla domain'de birebir aynı cümleyle geçen `validateCancelReason` ve `validatePeriod`)

**`validatePeriod(payload, futureMessage)` bu kuralın karma örneğidir:** ortak olan kısım (yıl/ay geçerliliği ve `toPeriod(...) > currentPeriod()` karşılaştırması) ile ortak cümle (`"Geçersiz tarih bilgisi."`) paylaşılır, gelecek dönem reddinin cümlesi ise domaine özgü olduğu için parametreyle geçer (`dues` → aidat işlemi, `report` → rapor).: kullanıcıya dönen alan metni her zaman çağıran domain'de kalır, çünkü aynı sınır farklı domain'lerde farklı cümlelerle anlatılır (`"Geçersiz tarih."` / `"Geçersiz ödeme tarihi."` / `"Geçersiz çıkış tarihi."`). Yeni bir handler'da tarih ya da e-posta doğrularken kendi regex'ini yazma.

**5. Dönüş sözleşmesi.** Her handler `{ success: boolean, ... }` döner (`system` hariç). Hata durumunda `message` kullanıcıya gösterilebilir Türkçe metindir, iç hata detayı renderer'a sızdırılmaz. İş kuralı ihlali `{ success:false, message }` **döndürerek** bildirilir, throw yalnızca beklenmeyen hatalar içindir.

Renderer bir hata türüne göre **dallanıyorsa** servis ayrıca makine-okunur bir `code` alanı döner ve renderer o alana bakar. `message` metnine `startsWith`/`includes` ile bakma, metin değişince dallanma sessizce bozulur. Mevcut kod:

| Servis                 | `code`                  | Ek alan       | Renderer davranışı                         |
| ---------------------- | ----------------------- | ------------- | ------------------------------------------ |
| `resetAccountPassword` | `INVALID_RECOVERY_CODE` | yok           | Recover sayfası adım 1'e döner             |
| `verifyRecoveryCode`   | `INVALID_RECOVERY_CODE` | yok           | Adım 1'de mesaj gösterir                   |
| `deleteApartment`      | `HAS_UNPAID_DUES`       | `unpaidTotal` | Tutarı gösterip `force:true` ile tekrarlar |
| `recordPayment`        | `OVERPAYMENT`           | `remaining`   | Kalan borcu `formatCurrency` ile uyarır    |

Kullanıcının dialogu kapatması hata değildir ve mesaj metniyle anlaşılmaz: `runBackup` ile `saveReportFile` bu durumda `{ success:false, cancelled:true }` döner, çağıran (`Profile`, `Reports`) `cancelled` alanına bakıp sessizce çıkar.

**6. Servis gövdesinin tek şekli.** Sahiplik ve iş kuralı kontrolleri fonksiyonun başında yapılır ve ihlal `return { success:false, message }` ile bildirilir. Kontroller `getDb().transaction(...)` bloğunun **dışındadır**, transaction yalnızca yazmaları sarar. Tek süreç ve senkron DB olduğu için kontrol ile yazma arasına başka bir işlem giremez. `catch` yalnızca beklenmeyen hata içindir: hata **nesnesini** `console.error("[<domain>.service] <fn>:", err)` ile loglar ve kullanıcıya **sabit** bir metin döndürür (DB kısıtı tetiklenebilen fonksiyonlarda `resolveDbError(err, "<İşlem>")`, salt okuma fonksiyonlarında elle yazılmış cümle). **`err.message` hiçbir zaman renderer'a döndürülmez.**

**`COLUMN_LABELS` yalnızca gerçekten erişilebilen kolonlar için yazılır.** `createDbErrorResolver`'ın etiket tablosu iki dalda okunur: UNIQUE ve NOT NULL. CHECK ve FOREIGN KEY dalları etiketi hiç kullanmaz. Dolayısıyla bir kolonun etiketi ancak o kolon bir UNIQUE index'teyse ya da NOT NULL ise mesaj üretebilir. `resident/service.js` bu yüzden `createDbErrorResolver()`'ı **argümansız** çağırır: `residents` tablosunda hiç UNIQUE index yoktur ve etiketlenebilecek kolonların tamamı nullable'dır, yani o tablodaki her ihlal CHECK'tir. Yeni bir etiket eklemeden önce kolonun şemada UNIQUE ya da NOT NULL olduğunu doğrula.

**7. main→renderer eventleri** (`EVENTS.*`, `splash:*`) `webContents.send` ile gönderilir, preload `safeOn` unsubscribe fonksiyonu döner. Abonelik bir React bileşeninde kuruluyorsa bu fonksiyon `useEffect` cleanup'ında çağrılmalıdır. Bugün tek abone `useTheme.js`'tir, aboneliği modül gövdesinde bir kez kurar ve uygulama ömrü boyunca yaşadığı için dönen fonksiyonu bilinçli olarak atar.

**8. Yetkilendirme.** IPC katmanında oturum doğrulaması yoktur (tek kullanıcılı masaüstü uygulaması). Veri izolasyonu **`buildingId`** parametresiyle sağlanır: bina verisi sorguları her zaman `WHERE building_id = ?` ya da `JOIN apartments a ... a.building_id = ?` içermelidir. İptal işlemlerinde **iki ayrı kimlik** geçer: sahiplik `buildingId`, işlemi yapan kişi `userId` (`cancelled_by` / `collected_by`). Bina CRUD'unda izolasyon `owner_id` ile yapılır.

### 5.3 Çağrı sözleşmesi

Her `electronAPI` metodu **sıfır ya da tek bir nesne** argümanı alır ve onu `safeInvoke`'a olduğu gibi iletir. Pozisyonel argüman ve ham skaler payload yoktur. Bundan çıkan iki alt kural: (a) preload payload'ı **yeniden paketlemez**, (b) sahiplik anahtarı (`buildingId` / `ownerId`) her zaman payload'ın **üst seviyesindedir**, iç içe bir `data` nesnesinde değil. Aynı kural handler → service sınırında da geçerlidir: servis fonksiyonları doğrulanmış payload nesnesini olduğu gibi alır. Servis **içi** yardımcılar (`insertRecord`, `cancelRecord`, `findOwnedResident`, `findDuplicateName`) pozisyonel kalabilir, kural IPC sınırı içindir. Tek istisna `onToggleTheme(callback)`, o invoke değil event aboneliğidir.

---

## 6. Kimlik Doğrulama ve Oturum

**Tek hesap modeli.** Uygulamada rol yoktur, bir makinede bir hesap vardır. Bu hesap binaları yönetir, kendi kurtarma kodunu tutar ve gerektiğinde devredilir. Kullanıcıya dönük etiket "Site Yöneticisi"dir. Hesabın kişi adı `manager_name`'de tutulur, kurulumda girilir ve `useCurrentUser().managerName` ile gösterilir. Tek hesap olduğundan servisler satırı `ORDER BY id LIMIT 1` ile bulur.

- Şifreler `bcryptjs` ile hash'lenir, düz metin hiçbir yerde saklanmaz ya da loglanmaz.
- **Oturum:** `sessionStorage` → `currentUser` anahtarı. Tek doğruluk kaynağı `src/hooks/useCurrentUser.js`'tir. `useCurrentUser()` reaktif okumanın tek yoludur, `setCurrentUser(user)` login sonrası yazar ve `user-session-changed` yayınlar, `clearCurrentUser()` logout'ta `sessionStorage.clear()` çağırır. **Kural:** `sessionStorage.setItem/clear` + elle `dispatchEvent` yazma, helper'ları kullan.
- **Kalıcı oturum ("Beni hatırla") yoktur.** Oturum yalnızca `sessionStorage`'dadır, uygulama kapanınca silinir.
- **Rota koruması:** `ProtectedRoute` yalnızca auth/guest ayrımı yapar. `guestOnly` girişliyi `/select-building`'e atar, korumalı rota girişsizi `/`'e atar. Bina gerektiren sayfalar ayrıca `RequireBuilding` altındadır (§11).

### İlk Kurulum (Setup)

1. Taze kurulumda `users` boştur, hesap satırı seed edilmez.
2. Renderer açılışta `getSetupState()` çağırır. Hesap satırı yoksa `needsSetup:true` döner ve `/setup`'a yönlenir. **Hesap satırının varlığı kurulumun tamamlandığı anlamına gelir**, ara bir "pending" durum yoktur.
3. Kullanıcı ad soyad + kullanıcı adı + şifre belirler → `completeSetup({ username, password, managerName })` hesabı `INSERT` ile oluşturur, kurtarma kodu üretilip **bir kez** gösterilir. Kod bir modalda değil sayfa içi "Kurulum Tamamlandı" durumunda gösterilir: kurtarma kodu + "Kodu Kopyala" + kullanıcı adı. Sayfa `/login`'e kendiliğinden yönlenmez, kullanıcı butona basar ve kullanıcı adı `location.state` ile Login'e taşınır.
4. Endpoint yalnızca hesap satırı **yokken** çalışır ve tek yazma yolu `INSERT`'tür. Sayfa mount'ta `getSetupState` sorar, kurulum tamamlanmışsa `/login`'e yönlenir.

### Şifre Kurtarma

- Kurtarma kodu 16 karakterdir, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` alfabesinden (I/O/0/1 yok) üretilir ve `XXXX-XXXX-XXXX-XXXX` biçiminde gösterilir. `normalizeRecoveryCode` tire, boşluk ve küçük harfi tolere eder.
- `resetAccountPassword(recoveryCode, newPassword)` `/recover` sayfasından oturumsuz çağrılır. Kod **tek kullanımlıktır**, her kullanımda yenisi üretilir. Sayfa iki adımlıdır (1: kod, 2: yeni şifre + tekrar). Adım 1 `verifyRecoveryCode` ile kodu yan etkisiz doğrular, böylece kullanıcı şifreyi yazmadan hatayı görür. Nihai ve yetkili doğrulama yine `resetAccountPassword` içindedir, adım 1 yalnızca erken UX kontrolüdür.
- **Kullanıcı adı için ayrı kurtarma endpoint'i yoktur.** `resetAccountPassword` başarı yanıtında `username` da döner ve `/recover` üçüncü adımı (sayfa içi "Şifreniz Yenilendi" durumu) yeni kurtarma koduyla birlikte kullanıcı adını gösterir. Kod panoya otomatik yazılmaz, "Kodu Kopyala" butonu vardır.
- **Login otomatik doldurma:** `getSetupState` kurulum tamamlanmışsa `username` alanını da döndürür. Login mount'ta bunu çağırıp kullanıcı adı alanını doldurur ve odağı şifreye alır. `location.state?.username` varsa ona öncelik verilir ve sorgu atlanır.
- Giriş yapmış hesap Profile'dan `regenerateRecoveryCode(password)` ile yeni kod üretir.
- Login'de timing attack koruması vardır: kullanıcı bulunamasa da sahte hash karşılaştırması yapılır (`DUMMY_HASH`). **Yalnızca login'de anlamlıdır** ve başka yola kopyalanmamalıdır: kurtarma yollarında hesabın varlığı `getSetupState` ile zaten açıkça bildirilir, `regenerateRecoveryCode` ise açık oturum ister.

### Hesap Yönetimi (Profile sayfası)

- **Şifre değiştir:** `changePassword(userId, oldPassword, newPassword)`. Mevcut şifre doğrulanır, yeni şifre eskisiyle aynı olamaz.
- **Yeni kurtarma kodu üret:** `regenerateRecoveryCode(password)`.
- **E-posta:** `updateEmail(userId, email)`. İsteğe bağlıdır, boş değer kaldırır.
- **Hesabı Devret:** `transferAccount(userId, password, newPerson)`. Mevcut şifre doğrulanır, `manager_name` yeni kişiye set edilir, tek kullanımlık geçici şifre **ve yeni bir kurtarma kodu** üretilir, ikisi de ardışık iki modalda bir kez gösterilir (`temporaryPassword`, `transferredRecoveryCode`). Kurtarma kodunun yenilenmesi zorunludur, aksi hâlde devreden kişi elindeki eski kodla şifreyi sıfırlayıp hesaba geri girebilirdi. Binalar ve veriler aynı hesapta kalır. Devir sonrası eski şifre geçersiz olur, renderer oturumu kapatıp `/login`'e atar.
- **Veri Yedeği:** "Yedek Al" butonu (`runBackup`). Geri yükleme burada değildir, menüdedir.
- **Bina yönetimi Profile'da değildir.** Yeniden adlandırma, arşivleme ve geri getirme `SelectBuilding` sayfasındadır.

---

## 7. Veritabanı

### 7.1 Bağlantı ve Pragma'lar (`database/db.js`)

- **Tek bağlantı**, main process'te, **açık bir `openDatabase()` çağrısıyla** açılır. Modül yüklenirken açılmaz. Dev'de dosya proje kökündedir (`database.db`), paketli sürümde `%APPDATA%/mavikent-site-yonetimi/` altındadır.
- **Modül üç fonksiyon export eder, `db` nesnesini değil:**
  - `openDatabase()` bağlantıyı açar (idempotent), pragma'ları uygular, `will-quit` dinleyicisini kaydeder ve bağlantıyı döndürür. **Tek çağıranı `main.js`'in `connectDatabase()`'idir.**
  - `getDb()` açık bağlantıyı döndürür, açılmamışsa `throw` eder. Service'ler her sorguda bunu çağırır, modül gövdesinde bağlantı **yakalamaz**.
  - `closeDb()` aşağıdaki kapanış adımlarını uygular.
- Pragma'lar: `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=3000`, `cache_size=-16000`, `temp_store=MEMORY`.
- `closeDb()`: `optimize` + `wal_checkpoint(TRUNCATE)` + `close`, sonra modül içi referansı `null`'lar. Böylece kapanmış bir bağlantı `getDb()` ile dağıtılmaz. Üç adım da birbirinden bağımsız denenir. **`will-quit`'te** otomatik çağrılır (`before-quit` değil, çünkü o olay pencereler kapanmadan önce tetiklenir ve renderer hâlâ IPC gönderebilecekken bağlantıyı kapatırdı). Restore işlemi dosya kilidini bırakmak için elle çağırır.
- Açılışta yol `[Database] Opening database: <path>` satırıyla loglanır.
- better-sqlite3 **senkron** çalışır, sorgular event loop'u bloklar. Uzun sorgu yazma.

### 7.2 Şema

**Tüm tablolarda geçerli iki kural:** `created_at`/`updated_at` NOT NULL'dur ve DEFAULT'ları TR saatidir. Finansal tablolar (`dues`, `due_payments`, `incomes`, `expenses`, `payment_cancellations`) **BEFORE DELETE trigger'ı ile korunur**, yani §8'in "silinmez" kuralı yalnızca serviste değil DB'de de zorlanır.

```sql
users                 (id, username, email, manager_name, password_hash, recovery_hash,
                       is_active, last_login, password_changed_at, created_at, updated_at)
                       idx_users_username (username COLLATE NOCASE) UNIQUE
                       -- username: NOT NULL, 3-30, yalnızca [A-Za-z0-9_]. Tekillik kolon içi
                       --   UNIQUE ile değil ayrı index ile, collation açıkça görünsün diye
                       -- manager_name: NOT NULL, 2-60. Hesabı kullanan kişinin adı
                       -- email: UNIQUE ve NOT NULL DEĞİL. Kimlik/kurtarma işlevi yok, bilgi amaçlı
                       -- recovery_hash: NOT NULL. Kurtarma kodunun bcrypt hash'i (tek kullanımlık).
                       --   Satır varsa kod da vardır, servis null kontrolü yapmaz
                       -- password_changed_at: NOT NULL, son şifre değişikliği. Kurulumda INSERT ile
                       --   yazılır, yani kurulum durumu göstergesi DEĞİLDİR, satırın varlığı odur
                       -- is_active: bugün yazılmıyor (hep 1), login + createBuilding'de okunur

buildings             (id, owner_id→users.id, name CHECK(len 2-60), is_active, is_removed,
                       created_at, updated_at)
                       idx_buildings_owner_name (owner_id, name COLLATE NOCASE)
                         UNIQUE WHERE is_removed = 0
                       -- Defterin sahibi varlık. Bir kişi birden fazla bina yönetebilir
                       -- Silinmez: is_active=0 arşiv, is_removed=1 kalıcı kaldırma (§8/11)
                       -- Index kısmidir: kaldırılan binanın adı yeniden kullanılabilir

apartments            (id, building_id→buildings.id ON DELETE RESTRICT, apartment_no, floor,
                       type∈{0+1,1+1,2+1,3+1,4+1}, square_meters, due_amount,
                       is_active, created_at, updated_at)
                       idx_apartments_building_no (building_id, apartment_no COLLATE NOCASE) UNIQUE
                       -- apartment_no 1-10, yalnızca harf/rakam · floor -2..99
                       -- square_meters 0<x<=1000 · due_amount 0<x<=50000

residents             (id, apartment_id→apartments.id ON DELETE CASCADE,
                       full_name, phone, email, national_id, resident_type∈{owner,tenant},
                       move_in_date, move_out_date, is_active, notes, created_at, updated_at)
                       idx_residents_apartment_id (apartment_id)
                       -- İsteğe bağlı metin alanları doluysa boşluktan ibaret olamaz
                       -- full_name<=60 · phone 10-20 ([0-9+()- ]) · email 5-254 · notes<=500
                       -- national_id 11 hane · move_out_date >= move_in_date
                       -- INSERT ve UPDATE trigger'ı: move_out_date <= bugün ise is_active=0
                       --   (gelecek tarihli çıkış sakini aktif bırakır)

dues                  (id, apartment_id→apartments.id ON DELETE RESTRICT, year, month,
                       due_amount CHECK(>0 AND <=50000),
                       paid_amount CHECK(>=0 AND <=due_amount),
                       status, created_at, updated_at)
                       UNIQUE(apartment_id, year, month)
                       -- status paid_amount'tan TÜRETİLİR ve CHECK ile ona bağlanmıştır:
                       --   paid>=due→paid, paid>0→partial, aksi→unpaid. Servisteki
                       --   calcDueStatus ile birebir aynı ifadedir, biri değişirse diğeri de
                       -- FK RESTRICT: aidat kaydı §8 gereği silinemez

due_payments          (id, due_id→dues.id, collected_by→users.id,
                       amount CHECK(>0 AND <=1000000),
                       payment_method∈{cash,bank_transfer,card,other},
                       payment_date CHECK(ISO + 2000-01-01..2100-12-31),
                       note CHECK(trim boş değil AND len<=500), created_at)
                       idx_due_payments_due_id (due_id)

payment_cancellations (id, payment_id→due_payments.id UNIQUE, cancelled_by→users.id,
                       cancel_reason CHECK(trim boş değil AND len<=300), cancelled_at)
                       -- Immutable audit log: trigger ile UPDATE ve DELETE engellenir

incomes               (id, building_id→buildings.id, due_payment_id→due_payments.id UNIQUE,
                       amount, date, description, category∈{dues,rent,parking,donation,other},
                       is_cancelled, cancelled_at, cancel_reason, cancelled_by→users.id,
                       created_at, updated_at)
                       idx_incomes_building_date · idx_incomes_active_only (WHERE is_cancelled=0)
                       -- Tablo düzeyi CHECK: iptal alanlarının dördü ya hep NULL ya hep dolu
                       -- Trigger: iptal edilmiş kayıt UPDATE edilemez

expenses              (id, building_id→buildings.id, amount, date, description,
                       category∈{maintenance,cleaning,utility,staff,other},
                       is_cancelled, cancelled_at, cancel_reason, cancelled_by→users.id,
                       created_at, updated_at)
                       idx_expenses_building_date · idx_expenses_active_only
                       -- incomes ile aynı iptal CHECK'i ve trigger'ları
```

### 7.3 Migration / Schema Sistemi (`database/migrate.js`)

`runMigrations()` her başlangıçta çalışır, sırası:

1. **`database/migrations/`** uygulanmamış dosyalar ada göre sıralı çalıştırılır, her biri kendi transaction'ındadır ve `migrations` tablosuna kaydedilir.
   - Kayıt tablosu `migrate.js` içinde bootstrap edilir, `schema/` altında değildir, çünkü schema aşamasından önce gerekir. `applied_at` INSERT'te elle yazılmaz, DEFAULT'tan gelir.
   - Migration sırasında `foreign_keys=OFF`, sonunda `foreign_key_check` yapılır ve ihlal varsa rollback edilir.
   - **Hata toleransı yoktur.** Patlayan migration transaction'ı geri alır ve açılışı durdurur. Boş `.sql` dosyası da tolere edilmez.
   - **Fresh install:** `users` tablosu yoksa tüm migration'lar çalıştırılmadan "uygulandı" işaretlenir, tabloları schema aşaması güncel haliyle oluşturur.
   - `applyMigrations` klasörün yokluğunu tolere eder. Klasör boş kaldığında paketleyici onu asar'a taşımayabilir, bu kontrol olmazsa paketli sürüm açılışta patlar.
2. **`database/schema/`** `CREATE TABLE/TRIGGER/INDEX IF NOT EXISTS` ile tek transaction'da yüklenir, mevcut kurulumda no-op'tur. Dosya numaraları FK bağımlılık sırasını izler: `01_users` → `02_buildings` → `03_apartments` → `04_residents` → `05_dues` → `06_due_payments` → `07_payment_cancellations` → `08_incomes` → `09_expenses`.

**Migration geçmişi bir kez sıkıştırıldı** ve o günkü şema `schema/` altında donduruldu. Sonraki migration'lar `001`'den devam eder.

| Durum                                | Ne yapılır                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yeni tablo                           | `database/schema/NN_tablo.sql` oluştur, numarayı referans verdiği tüm tablolardan sonraya koy. Hepsi `IF NOT EXISTS` olduğu için mevcut kurulum etkilenmez |
| Mevcut tabloya sütun/index/trigger   | `database/migrations/NNN_english_description.sql` **VE** ilgili `schema/` dosyasını aynı hale getir. Fresh install ile mevcut kurulum aynı şemada buluşmalıdır        |
| CHECK constraint değişikliği         | SQLite `ALTER ... CHECK` desteklemez, tablo yeniden oluşturma migration'ı gerekir                                                                          |
| Tablo silme ya da yeniden adlandırma | Önce kullanıcıya sor                                                                                                                                       |

**Migration yazım kuralları:** dosya adı **İngilizcedir** (`001_resident_date_range.sql`), gövde salt SQL'dir (JS migration yok), geri alma (down) mekanizması yoktur, geri dönüş yeni bir migration ile yapılır. Tablo yeniden oluşturan bir migration index ve trigger'ları da yeniden kurar, çünkü `DROP TABLE` onları da düşürür. **Mevcut veri yeni kısıtı ihlal ediyorsa migration patlamaz, ihlal eden değeri `CASE` ile `NULL`'a çeker:** patlayan migration açılışı durdurur ve kullanıcı uygulamayı hiç açamaz. Bir migration release edildiyse **asla düzenlenmez**, yeni dosya eklenir.

### 7.4 SQL Yazım Standartları

- Bağlantıya erişim **her zaman `getDb()` ile ve çağrı anında** yapılır. Modül gövdesinde `const db = getDb()` yazma, o satır modül yüklenirken çalışır ve bağlantı henüz açılmamış olur.
- Her sorgu **prepared statement**'tır. String birleştirme ile SQL üretme, dinamik filtre gerekiyorsa WHERE parçalarını koşullu kur ve değerleri her zaman parametre olarak geçir. Tablo adı şablon literaline gömülüyorsa (`financial` ve `report` servislerindeki `${table}`) o argüman yalnızca modül içinden sabit string'le geçilir, payload'dan gelen hiçbir değer tablo adı olarak kullanılmaz.
- Birden fazla yazma içeren işlemler `getDb().transaction(() => {...})()` içindedir.
- Bina verisi sorgularında `building_id = ?` filtresi zorunludur (§5.2 madde 8).
- Para `REAL` saklanır. Ekranda `src/utils/currency.js` → `formatCurrency()` ile formatlanır.
- Tarihler ISO-8601 `TEXT`'tir (`YYYY-MM-DD` ya da `datetime('now', '+3 hours')`).
- **Saat dilimi.** Tüm otomatik zaman damgaları **Türkiye yerel saati (UTC+3)** ile saklanır. Türkiye DST kullanmadığından sabit `+3 hours` deterministiktir. Her `created_at/updated_at/cancelled_at/last_login` yazımı bu ifadeyi kullanır. **`updated_at` için trigger yoktur**, yazan her UPDATE ifadesi onu kendisi set etmek zorundadır. Kullanıcının seçtiği takvim tarihleri (`date`, `payment_date`, `move_in_date`, `move_out_date`) kaydırılmaz.
- JS tarafında "bugün" ve "şu an" da TR bazlıdır ve **elle hesaplanmaz**. Kural **süreç başına tek sahiptir**: renderer'da `src/utils/date.js`, main'de `electron/modules/shared/trTime.js`. `+3` kaydırmasını bu iki dosya dışında yazma.
  - **İki dosya aynı kodu taşır ve bu bilinçlidir, ortaklaştırılmaz.** `TR_OFFSET_MS`, `trNow`/`nowInTr` ve `trToday`/`getToday` iki tarafta da birebir aynıdır. Main CommonJS'tir, renderer ESM'dir ve aralarında IPC dışında bir yol yoktur, yani ortak bir dosya ancak iki modül sistemine birden uyan yapay bir katmanla mümkün olurdu. Çözüm ortak dosya değil, her süreçte tek sahiptir. Zaman mantığını bu iki dosyadan birine ekle, üçüncü bir yer açma.
  - Servis SQL'lerinde `datetime('now', '+3 hours')` metni `trTime.js`'in `TR_NOW_SQL` sabitinden gelir ve şablon literaline gömülür (sabit bir SQL parçasıdır, değer değildir). Bu metin `trTime.js` dışında yalnızca DDL DEFAULT'larında geçer: `database/schema/*.sql` dosyaları ve `database/migrate.js`'in `migrations` tablosu bootstrap'i. `migrate.js` `TR_NOW_SQL`'i **import etmez**, çünkü `database/` `electron/`'a bağımlı değildir ve bu yön korunur.

---

## 8. Kritik İş Kuralları

> **Silme yasağı DB'de zorlanır.** `dues`, `due_payments`, `incomes`, `expenses` ve `payment_cancellations` tablolarında `BEFORE DELETE` trigger'ı `RAISE(ABORT)` eder. Kodda hiçbir `DELETE FROM` yoktur ve olmamalıdır.

1. **Aidat kaydı silinemez**, yalnızca düzenlenebilir. `status` alanı `paid_amount`'tan türetilir ve CHECK ile ona bağlıdır, yani `paid_amount` yazan her UPDATE `status`'ü de doğru değerle yazmalıdır.

2. **Aylık tahakkuk (`ensureMonthlyDues(buildingId)`).** `dues` satırı ödemeyi beklemez: her aktif daire için, **dairenin oluşturulma ayından içinde bulunulan aya kadar** her ay bir satır üretilir (`INSERT OR IGNORE` + recursive CTE, tutar `apartments.due_amount`'un o anki değeriyle **dondurulur**). Üretici idempotenttir ve okuma öncesi çağrılır: `getDuesForMonth`, `dashboard.getStats`, `report.getReportData` ve `deleteApartment`'ın borç kontrolü. Ayrı bir zamanlayıcı yoktur, uygulama açılıp ilgili sayfaya girildiğinde eksik aylar tamamlanır. Okuma sorguları `LEFT JOIN` + `COALESCE(d.due_amount, a.due_amount)` desenini korur, çünkü tahakkuk ile okuma arasındaki dönemde satır henüz üretilmemiş olabilir.
   - **Tahakkukun iki yolu vardır ve tutar dondurma kuralı ikisinde de aynıdır.** `ensureMonthlyDues` toplu ve geriye dönüktür, bir binanın tüm aktif dairelerinin eksik aylarını birden üretir. `recordPayment` ise onu **çağırmaz**, ödeme alınan tek daire ve tek dönem için kendi hedefli `INSERT OR IGNORE`'unu yazar, çünkü ödeme sırasında binanın tüm geçmişini üretmek gereksizdir. Bu ikinci yol `duesAccrual.js`'te değil `dues/service.js`'tedir, yani `apartments.due_amount`'un dondurulma kuralı değişirse **iki yer birden** güncellenmelidir.
   - **Geçerli dönem penceresi `[dairenin oluşturulma ayı, içinde bulunulan ay]`'dır ve iki uçtan da zorlanır.** Üst uç handler'dadır (`shared/validate.js` → `validatePeriod`, `dues` ve `report` kanallarında `toPeriod(year, month) > currentPeriod()` reddedilir), alt uç serviste, çünkü dairenin oluşturulma ayını bilmek DB sorgusu ister: `getDuesForMonth` ve `report.getReportData` daireyi `createdPeriodSql("a.") <= ?` ile listeden düşürür, `recordPayment` erken dönem için reddeder. Aksi hâlde daire, var olmadığı bir ay için bugünkü aidat tutarıyla borçlu görünür ve o aya ödeme alınabilirdi. Dönem aritmetiğinin tek sahibi `trTime.js`'tir (`toPeriod`, `currentPeriod` ve SQL karşılığı `createdPeriodSql`), `yıl * 12 + ay` ifadesini elle yazma.

3. **Aidat tutarı değişikliği geçmişe işlemez.** Hem `bulkUpdateDueAmount` hem `updateApartment` yalnızca `apartments.due_amount`'ı yazar, mevcut `dues` kayıtlarına dokunmaz. Tahakkuk etmiş aylar (içinde bulunulan ay dahil) eski tutarda kalır, yeni tutar bir sonraki ayın tahakkukunda geçerli olur.

4. **Gelir ve gider silinemez.** `cancelIncome`/`cancelExpense` ile `is_cancelled=1` yapılır, iptal nedeni ve iptal eden kaydedilir. İptal edilmiş kayıt sonradan güncellenemez (trigger).

5. **Ödeme iptali.** `due_payments` kaydı silinmez, `payment_cancellations`'a immutable kayıt eklenir. Bağlı `incomes` kaydı aynı transaction'da otomatik iptal edilir. `paid_amount` çıkarma ile değil **aktif ödemelerin `SUM`'ı ile yeniden hesaplanır**, böylece idempotent ve tutarlı kalır.

6. **Aidat bağlantılı gelir** (`due_payment_id IS NOT NULL`) doğrudan iptal edilemez, yalnızca `cancelPayment` üzerinden otomatik iptal edilir.

7. **Daire soft-delete'i (`deleteApartment`) ve yeniden aktifleştirme.** Daire `is_active=0` yapılır, satır silinmez. `recordPayment` `AND is_active=1` kontrolü içerir, pasif daireye ödeme alınamaz. Dört alt kural:
   - **Ödenmemiş borç iki adımlı onaya bağlıdır.** Pasif daire tüm okuma sorgularından düştüğü için ödenmemiş aidat tahsilat oranından ve raporlardan da düşer. Servis bu yüzden borç varken **reddeder** ve `{ success:false, code:"HAS_UNPAID_DUES", unpaidTotal }` döner. Renderer tutarı `formatCurrency` ile gösterip onay alır ve isteği `force: true` ile tekrarlar. `dues` satırları her hâlükârda veritabanında kalır.
   - **Aktif sakin aynı transaction'da çıkışlı yapılır** (`is_active=0`, `move_out_date = COALESCE(move_out_date, bugün)`). Tarih `COALESCE` ile yazılır: kullanıcı daha önce ileri tarihli bir çıkış girdiyse o tarih kullanıcının verisidir ve bugünle ezilmez.
   - **Aynı daire numarası yeniden kullanılabilir.** Unique index pasif satırları da kapsadığı için `addApartment` önce aynı numarada satır arar: aktif satır varsa reddeder, **pasif satır varsa onu yeni değerlerle güncelleyip `is_active=1` yapar**. Bu yolda `created_at` de o ana çekilir, çünkü tahakkuk `created_at` ayından başlar ve eski tarih korunsaydı dairenin pasif olduğu aylar için geriye dönük borç üretilirdi. İlk aktif dönemin `dues` kayıtları olduğu gibi durur.
   - **Dört endpoint de binanın durumunu doğrular.** Hedef bina kaldırılmışsa "Bina bulunamadı.", arşivlenmişse "Arşivlenmiş bir binada daire işlemi yapılamaz." döner.

8. **Sakinler.** `is_active=1` aktif sakindir, bir dairenin birden fazla geçmiş sakini olabilir. `move_out_date` bugün ya da geçmiş bir tarihe set edilince trigger `is_active=0` yapar, **gelecek** bir çıkış tarihi sakini aktif bırakır. Not: gelecek tarih geldiğinde otomatik deaktivasyon olmaz (trigger yalnızca yazma anında çalışır), tarih geçtikten sonraki ilk güncellemede deaktif olur. Sakin yaşam döngüsü daire formuna gömülü **değildir**, `updateApartment` sakine dokunmaz. Kullanıcı niyeti açık aksiyonlarla ifade edilir:
   - `addResident` dairede aktif sakin yoksa ekler, aktif sakin varken reddeder.
   - `updateResident` **yalnızca aktif** sakin satırını yerinde günceller ve overwrite eder. Çıkmış bir sakine gelen istek reddedilir, geçmiş kaydı değiştirilemez. Modal mevcut değerlerle prefill edilir, boş bırakılan alan bilinçli temizlemedir. **`move_out_date`'e dokunmaz:** o alanın tek sahibi `moveOutResident`'tır ve handler bu alanı `resident:update` kanalında **açıkça reddeder**, sessizce yok saymaz. Düzenleme formunda çıkış tarihi alanı yoktur, dolayısıyla `updateResident` onu yazsaydı ya her düzenlemede tarihi silerdi ya da (eski `COALESCE` çözümünde olduğu gibi) yanlış girilmiş bir çıkış tarihi hiçbir yoldan temizlenemezdi.
   - `moveOutResident` `move_out_date` set eder, trigger deaktif eder. Zaten çıkmış bir sakin için reddeder. Tarih gelecekteyse sakin aktif kaldığı için başarı mesajı da bunu söyler, tek tip "çıkış kaydedildi" demez. **Değişim** = önce çıkış, sonra yeni sakin (iki açık adım, eski sakin geçmiş kaydı olarak korunur).
   - `getResidentsOverview` aktif daireleri ve aktif sakini (LEFT JOIN) döner. `getResidentHistory` bir dairenin tüm sakinlerini döner ve sahiplik kontrolünü **dairenin aktifliğine bakmadan** yapar (`findOwnedApartment`), çünkü pasife alınmış bir dairenin geçmişi de okunabilmelidir. Yazma yolları (`addResident`) aktiflik şartını korur (`findOwnedActiveApartment`).

9. **Ödeme kaydı → gelir kaydı.** `recordPayment` aynı transaction'da `incomes`'a `category='dues'` ve `due_payment_id` bağlı bir kayıt ekler. Fazla ödeme reddedilir (kalan borç kontrolü). Aidat geliri asla elle girilmez: `addIncome` handler'ı `category='dues'` gelen isteği **reddeder** (şemada değer geçerlidir, çünkü `recordPayment` doğrudan SQL ile yazar).
   - **Fazla ödeme kontrolü kuruş tamsayısı üzerinden yapılır.** `floorCents(kalan)` ile `roundCents(ödenen)` karşılaştırılır (kalan aşağı, ödenen en yakına yuvarlanır), böylece kayan nokta artığı ne kontrolü kaydırır ne de `paid_amount <= due_amount` CHECK'ini tetikler. Sınırın tek sahibi servistir: renderer kendi toleransını uygulamaz, isteği gönderir ve `code:"OVERPAYMENT"` + `remaining` yanıtını `formatCurrency` ile gösterir.

10. **Yedekleme ve geri yükleme** (`electron/modules/backup/service.js`). Geri yükleme **yalnızca menüden** çağrılır, IPC'si yoktur, çünkü uygulamayı yeniden başlatır. Yedek alma iki yerden tetiklenir: menü ve Profile'daki "Yedek Al" butonu (`backup:run`, `silent:true` ile dialog yerine `{success,message}` döner). Yedeğin ne zaman alındığı **hiçbir yerde saklanmaz**.
    - Yedek: `getDb().backup(filePath)` (WAL-güvenli online backup) + hedefteki artık `-wal`/`-shm` temizliği.
    - Geri yükleme: `validateBackupFile` → onay → mevcut DB `.bak`'a kopyalanır → `closeDb()` (Windows dosya kilidi için) → eski `-wal`/`-shm` silinir → kopyalama → `app.relaunch()` + `app.exit()` (`relaunch` tek başına kapatmaz). Hata olursa `.bak`'tan geri dönülür ve **bu yolda da yeniden başlatılır**, çünkü `closeDb()` sonrası bağlantı yeniden açılmaz.
    - **`validateBackupFile` iki şey doğrular:** `integrity_check` ve `REQUIRED_TABLES`'ın (`users`, `buildings`, `apartments`, `dues`) `sqlite_master`'da bulunması. İkincisi olmazsa başka bir programın sağlam SQLite dosyası da kabul edilir, üzerine yazılır ve kullanıcının verisi geri dönüşsüz kaybolurdu. Salt okunur test bağlantısı `finally` içinde kapatılır, aksi hâlde Windows'ta dosya kilitli kalıp sonraki kopyalamayı engeller.
    - **`.bak` silinmez.** Ne başarılı geri yüklemede ne de rollback'te. Yanlış yedek geri yüklendiğinde tek dönüş yolu odur ve rollback kopyalaması da başarısız olabilir. Dosyanın yolu başarı kutusunun `detail` alanında kullanıcıya gösterilir. Sonraki geri yükleme onu üzerine yazar, yani yalnızca bir önceki durum saklanır.

11. **Bina silinmez.** Arşiv (`is_active=0`) ve kaldırma (`is_removed=1`) iki soft-delete kademesidir, `buildings` satırı hiçbir yolla `DELETE` edilmez. `removeBuilding` yalnızca arşivdeki binada çalışır ve aktif bina için ayrı bir mesajla reddeder. Hesap içinde bina adı tekildir (büyük/küçük harf duyarsız), kontrol serviste yapılır ve DB'de kısmi UNIQUE index son savunma hattıdır.
    - **Kullanıcıya dönük karşılıkları farklıdır.** Kod ve bu doküman "arşiv" ve "kaldırma" der, arayüz "Sil" ve "Kalıcı Olarak Sil" der, arşiv bölümünün adı "Silinen Binalar"dır. Kullanıcıya giden her metin (servis mesajları dahil) arayüzün kelimelerini kullanır, "arşiv" kelimesi UI'da hiçbir yerde geçmediği için mesajlarda da geçmez.
    - **Dört yazma endpoint'i de `is_removed = 0` kapsamındadır.** `listBuildings` kaldırılmış binayı listelemez, `renameBuilding` / `updateBuildingStatus` / `removeBuilding` ise WHERE'lerinde bu koşulu taşır. Aksi hâlde kaldırılmış bir bina, kısmi UNIQUE index kendisini kapsamadığı için aktif bir binanın adını alabilirdi.

12. **Dashboard metrikleri (`getStats`).** Üç kartın tanımı da servistedir ve üçü de yalnızca **aktif** daireleri sayar, yani pasife alınmış bir dairenin kural 7 gereği tabloda duran borcu bu kartlara girmez.
    - **Kasa:** tüm zamanların iptal edilmemiş geliri eksi gideri. Dönem filtresi yoktur.
    - **Tahsilat:** yalnızca içinde bulunulan ayın `paid_amount / due_amount` oranı, tam sayıya yuvarlanmış yüzde. Ölçülecek tahakkuk yoksa (toplam `due` sıfır) `null` döner ve arayüz `—` gösterir. Sıfır tahsilat ile ölçülecek bir şeyin olmaması aynı görünmesin diye böyledir.
    - **Gecikme:** yalnızca geçmiş ayların `due_amount - paid_amount` toplamı. Tahakkuk gelecek ay üretmediği için (kural 2) üst sınır kontrolü gerekmez.
    - Para değerleri **serviste yuvarlanmaz**, biçimlendirme `formatCurrency`'nin işidir. Servisteki bir `Math.round` kuruşu sessizce siler.

---

## 9. Validasyon Katmanları

Girdi doğrulaması **tek katmanda** yapılır (handler). Altındaki iki katman farklı işler görür, değişiklik yaparken ikisini de gözden geçir:

| Katman     | Dosya                            | Ne yapar                                                                                                                                                                                                                      |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Bridge  | `preload.js`                     | **Yalnızca kanal whitelist'i.** `safeInvoke` yalnızca `INVOKE_CHANNELS`, `safeOn` yalnızca `EVENT_CHANNELS` kabul eder. Böylece bir invoke kanalına abone olunamaz, bir event kanalı da invoke edilemez. Payload'a **bakmaz** |
| 2. Handler | `electron/modules/*/handlers.js` | **Asıl doğrulama katmanı.** Alan varlığı, tip, aralık, format (regex, enum), rezerve değerler                                                                                                                                 |
| 3. DB      | `database/schema/*.sql`          | Son savunma hattı: CHECK, NOT NULL, UNIQUE, FK, trigger                                                                                                                                                                       |

Handler katmanı asıl güvenlik sınırıdır (preload atlatılabilir varsayılır). DB katmanındaki ihlal service'teki `resolveDbError` ile Türkçe mesaja çevrilir, ortak `createHandle` zarfı yalnızca beklenmeyen throw'ları jenerik mesaja çevirir.

**Handler ↔ şema paritesi (kural).** Handler validasyonu, ilgili sütunun `CHECK` kısıtındaki aralığı, formatı ve enum'unu **birebir yansıtmalıdır**. Amaç, sınır dışı girdinin jenerik DB hatası yerine handler'da düzgün Türkçe mesajla yakalanmasıdır. Şemadaki bir CHECK'i değiştirirken handler'daki eş kontrolü de güncelle. Mevcut parite noktaları:

- `apartment` → daire no (1-10, harf/rakam), kat (-2..99), metrekare (0<x≤1000), aidat (0<x≤50000). Sakin alanları apartment'ta değil `resident` handler'ında doğrulanır.
- `resident` → ad soyad (≤60, isteğe bağlı), telefon (10-20, `[0-9+()- ]`), e-posta (ASCII kontrolü + `isValidEmail`), TC (11 hane), sakin türü, not (≤500), giriş/çıkış tarihi (`isValidDate` + `çıkış ≥ giriş`, aynı aralık şemada da CHECK'tir). Aynı sınırlar `Residents.jsx` form alanlarında `maxLength` olarak da durur. Yalnızca sakine özgü kurallar bu dosyada kalır (`PHONE_RE`, `NATIONAL_ID_RE`, `NON_ASCII_RE`). İsteğe bağlı metin alanlarının tamamı tek bir `OPTIONAL_TEXT_RULES` tablosundan doğrulanır, alan başına ayrı `if` bloğu yazılmaz.
- `auth` → `login` kullanıcı adı + şifre zorunlu. `completeSetup` kullanıcı adı `[A-Za-z0-9_]{3,30}` + şifre ≥8 + `managerName` 2-60. `transferAccount` `userId` + `password` + `newPerson` (2-60). `changePassword` `userId` + eski/yeni şifre (≥8). `updateEmail` `userId` + `email` (boş/null kaldırır, doluysa `isValidEmail`). `resetAccountPassword` `recoveryCode` + yeni şifre (≥8). `verifyRecoveryCode` ve `regenerateRecoveryCode` ilgili tek alan.
- `building` → bina adı 2-60 zorunlu, `ownerId`/`buildingId` pozitif tamsayı. **Ad tekilliği handler'da değil serviste** kontrol edilir (`findDuplicateName`, DB sorgusu gerektirir), mesaj çakışan binanın silinenler arasında olup olmadığına göre ayrışır.
- `dues` → dönem (`isValidYear` + `isValidMonth`, ayrıca **gelecek dönem reddedilir**), ödeme tutarı (0<x≤1.000.000), not ≤500 (trim'lenir), iptal nedeni ≤300 (`shared/validate.js`), ödeme tarihi (`isValidDate`), `collected_by` pozitif tamsayı.
- `financial` → tutar (0<x≤1.000.000), açıklama zorunlu ≤500, tarih (`isValidDate`, ayrıca **gelecek tarih reddedilir**, `trToday()` ile), iptal nedeni ≤300, kategori enum'u (gelir tarafında **elle girilebilenler**: `rent,parking,donation,other`, `dues` reddedilir. Gider: `maintenance,cleaning,utility,staff,other`). `getTransactions` isteğe bağlı `{year, month}` alır, `null` tüm zamanlar demektir. Bu kontrolün adı `validateOptionalPeriod`'dur, `shared/validate.js`'in `validatePeriod`'ü ile karıştırılmasın diye: o payload'ın kendi `year`/`month` alanlarını doğrular ve gelecek dönemi reddeder, bu ise isteğe bağlı bir dönem nesnesini doğrular ve gelecek kontrolü yapmaz.
- `report` → `buildingId` + `year` (2000-2100) + `month` (1-12), **gelecek dönem reddedilir**. `saveReportFile` dosya adı (≤150, yol ayırıcı ve Windows'ta geçersiz karakterler reddedilir) ve buffer (`Uint8Array`, boş olamaz).

**Handler ↔ renderer enum paritesi (kural).** Kullanıcının seçtiği enum listeleri iki süreçte ayrı ayrı durur ve ortaklaştırılamaz (main CommonJS, renderer ESM, aralarında yalnızca IPC var). Bugünkü çiftler: daire tipi (`apartment/handlers.js` → `APARTMENT_TYPES` ↔ `src/pages/Apartments/constants.js` → `APARTMENT_TYPES`), ödeme yöntemi (`dues/handlers.js` → `VALID_PAYMENT_METHODS` ↔ `constants.js` → `PAYMENT_METHOD_LABELS`), gelir/gider kategorileri (`financial/handlers.js` ↔ ilgili sayfaların `<select>`'leri) ve sakin türü (`resident/handlers.js` → `RESIDENT_TYPES` ↔ `Residents.jsx`). Birine değer eklerken diğerini ve şemadaki `CHECK`'i de güncelle. Renderer listesini sayfa içinde tekrar tanımlama, sahibi `constants.js`'tir.

**Girdi normalizasyonu (validasyondan önce).** Kullanıcı metin alanları handler katmanında, validasyondan önce in-place `trim()` edilir. Böylece hem validasyon hem DB'ye yazılan değer kırpılmış olur. **Normalize tek yerde, handler'da yapılır, service tekrar trim'lemez.**

- `apartment/handlers.js` → tek trim'lenen alan `apartment_no`.
- `resident/handlers.js` → `normalizeResidentData` tüm sakin string alanlarını kapsar, `validateResidentFields`'in ilk satırında çağrılır, yani ADD ve UPDATE yollarının ikisinde de çalışır. Trim'e ek olarak **boş değeri `null`'a çevirir** (boş string ve eksik alan dahil), böylece service `payload.x || null` yazmaz ve doğrulayıcılar tek bir `== null` kontrolüyle yetinir.
- `auth/handlers.js` → `trimField` yardımcısı: `username`, `email`, `managerName`, `newPerson`.
- `financial/handlers.js` → `normalizeFinancialData` (`description`, `category`). Boş bırakılan kategoriye varsayılanı (`other`) da bu fonksiyon yazar, service `||` fallback'i taşımaz.
- `building/handlers.js` → `validateBuildingName` bina adını doğrulamadan önce trim'ler ve kırpılmış değeri yalnızca geçerliyse payload'a yazar.
- `dues` ve `financial` iptal nedenleri ile `recordPayment`'ın `note` alanı handler'da trim'lenir.
- **Şifreler asla trim'lenmez.** Baştaki ya da sondaki boşluk kasıtlı olabilir.

---

## 10. electronAPI Endpoint Özeti

| Grup                   | Metodlar                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apartment              | `addApartment({buildingId, apartment_no, floor, type, square_meters, due_amount})`, `updateApartment({id, buildingId, ...aynı alanlar})`, `deleteApartment({id, buildingId, force?})`, `bulkUpdateDueAmount({buildingId, amount})`                                                                                                                                            |
| Auth                   | `login({username, password})`, `changePassword({userId, oldPassword, newPassword})`, `updateEmail({userId, email})`, `transferAccount({userId, password, newPerson})`, `resetAccountPassword({recoveryCode, newPassword})`, `verifyRecoveryCode({recoveryCode})`, `regenerateRecoveryCode({password})`, `getSetupState()`, `completeSetup({username, password, managerName})` |
| Backup                 | `runBackup()` (dialog açar, sonucu döndürür)                                                                                                                                                                                                                                                                                                                                  |
| Building               | `listBuildings({ownerId})`, `createBuilding({ownerId, name})`, `renameBuilding({buildingId, ownerId, name})`, `updateBuildingStatus({buildingId, ownerId, isActive})`, `removeBuilding({buildingId, ownerId})`. Beşi de yalnızca `is_removed=0` satırlara dokunur                                                                                                             |
| Dashboard              | `getStats({buildingId})` → `{cash, collections, delays}` (`collections` ölçülecek tahakkuk yoksa `null`)                                                                                                                                                                                                                                                                      |
| Dues                   | `getDuesForMonth({buildingId, year, month})`, `recordPayment({apartmentId, buildingId, year, month, paymentData})`, `cancelPayment({paymentId, buildingId, userId, reason})`, `getPaymentHistory({dueId, buildingId})`                                                                                                                                                        |
| Events (main→renderer) | `onToggleTheme(callback)`, tek callback alan metot, unsubscribe döner                                                                                                                                                                                                                                                                                                         |
| Financial              | `addIncome` / `addExpense` (`{buildingId, amount, date, description, category}`), `getTransactions({buildingId, period})` (`period` = `{year, month}` ya da `null`, dönüşü `{data, totals:{totalIncome,totalExpense,net}}`, toplamlar SQL'de iptalsiz hesaplanır), `cancelIncome` / `cancelExpense` (`{id, buildingId, userId, reason}`)                                                                                                                                    |
| Report                 | `getReportData({buildingId, year, month})`, `saveReportFile({filename, buffer})` (`buffer` bir `Uint8Array`'dir, main tarafında `Buffer.from` ile yazılır; kullanıcı vazgeçerse `{success:false, cancelled:true}` döner). `getReportData` aidat satırları `apartment_id` taşır                                                                                                                                                                                                                    |
| Resident               | `getResidentsOverview({buildingId})`, `getResidentHistory({apartmentId, buildingId})`, `addResident({apartmentId, buildingId, ...sakin alanları})`, `updateResident({residentId, buildingId, ...sakin alanları})`, `moveOutResident({residentId, buildingId, moveOutDate})`                                                                                                   |
| System                 | `getAppVersion()` (ham string döner, `{success}` sözleşmesi dışındadır)                                                                                                                                                                                                                                                                                                       |

Kanal adları için tek kaynak `electron/ipc/channels.js`'tir. Tablonun grup sırası o dosyadaki alfabetik sırayı izler.

---

## 11. React / Renderer Mimarisi

- **Routing:** HashRouter (Electron `file://` ve `app://` uyumu için, BrowserRouter kullanma). Rotalar `App.jsx`'te, tüm sayfalar `lazy()` + `Suspense`.
- **State yönetimi:** Global state kütüphanesi **yoktur** (bilinçli karar, uygulama küçük). Sayfa state'i lokal `useState`/`useEffect`, oturum `sessionStorage` + `useCurrentUser`, seçili bina `sessionStorage` + `useCurrentBuilding`, tema `useTheme`.
- **Seçili bina session'ı, bina durumu değişince güncellenir (kural).** `SelectBuilding`'de seçili binanın adı değişirse `setCurrentBuilding` yeniden yazılır, bina arşivlenir ya da kaldırılırsa `clearCurrentBuilding` çağrılır. Aksi hâlde `RequireBuilding` yalnızca session'a baktığı için kullanıcı arşivlenmiş bir binanın Dashboard'una dönüp oraya kayıt girebilir. Bina durumunu değiştiren yeni bir aksiyon eklenirse aynı kontrolü yaz.
- **`useTheme` modül düzeyinde tek kaynak tutar.** Tema değeri ve `onToggleTheme` IPC aboneliği hook'un içinde değil modül gövdesindedir, hook yalnızca bir dinleyici kaydeder. Aksi hâlde ikinci bir tüketici bağımsız bir tema state'i açar ve menüden gelen tek bir event temayı her abonede bir kez çevirir.
- **Bina bağlamı.** Giriş sonrası kullanıcı `/select-building`'e yönlenir, bina seçer ya da oluşturur, `setCurrentBuilding` çağrılır ve `/dashboard`'a gidilir. **Tek aktif bina varsa bu ekran atlanır** ve doğrudan panoya geçilir. Hesap menüsündeki "Bina Değiştir" `location.state.manual` bayrağıyla gider, o zaman atlama yapılmaz. Bina gerektiren sayfalar `RequireBuilding` guard'ı altındadır. **Building-scoped `electronAPI` çağrıları `user.id` değil seçili `building.id`'yi geçer.** Yalnızca işlemi yapan kişiyi kaydeden alanlar (`collected_by`, iptal `userId`, `changePassword`) `currentUser.id` kullanır. Dashboard başlığı ve Reports PDF başlığı `building.name`'dir.
- **Veri çekme deseni:** sayfa mount'ta `electronAPI` çağırır, `res.success` kontrol eder, hata mesajını SweetAlert ile gösterir. Cache katmanı yoktur, her sayfa girişinde taze veri alınır.
- **Alert/Dialog:** SweetAlert **yalnızca `src/utils/alert.js`'te** kullanılır. Sayfalar `sweetalert2`'yi import etmez, `showAlert` metodlarını çağırır. Yeni bir dialog gerekiyorsa `alert.js`'e metod ekle.
  - **Dönüş sözleşmesi:** `confirm`/`confirmDanger` ham `SweetAlertResult` değil **`boolean`** döner (`if (confirmed)` yaz, `result.isConfirmed` değil). `prompt`/`cancelReason`/`passwordPrompt` değeri döner, vazgeçilirse `null`.
  - **Gövde (`body`) iki biçim alır:** düz string ya da `{ html }` / `{ text }` nesnesi. Vurgu, satır sonu ya da tutar gösteren onaylar `{ html }` kullanır. HTML'e **kullanıcıdan gelen ham metin gömme**.
  - **İmza:** `confirm(title, body, cancelText, confirmText)`. İptal metni 3., onay metni 4. parametredir (ekranda `reverseButtons` ile soldan sağa görünen sırayla aynı) ve ikisi de zorunludur.
  - **Trim:** `prompt` girdileri her zaman trim'lenir, tek istisna `type: "password"` alanlarıdır.
  - **Genişlik:** Diyalog metodları amaca özel genişlik taşır. Paylaşılan bir metodu büyütmek yerine daha geniş bir diyalog için kendi metodunu ekle.
  - Dialog stilleri `style.css`'te `swal-*` sınıflarında tutulur, üretilen HTML'e inline `style` yazma.
  - **Kod ve şifre gösteren diyaloglar** (`regeneratedCode`, `temporaryPassword`) panoya otomatik yazmaz, kullanıcı "Kodu Kopyala" butonuna basar.
  - **Başarı bildirimleri modal değil toast'tır** (`showAlert.toast`). Modal kalanlar: hatalar, karar isteyen diyaloglar ve bir kez gösterilen kod diyalogları.
- **Formatlama.** Tarih ve saat için `src/utils/date.js` tek sahiptir: `MONTHS`, `formatMonthYear`, `getToday`/`getCurrentYear`/`getCurrentMonth` (hepsi TR bazlı), `formatDate`/`formatDateShort`/`formatDateTime`. Renderer'da ham `new Date()` ile "bugün" hesaplama, ay adı dizisini sayfa içinde tekrar tanımlama. Formatlayıcılar boş ya da geçersiz girdide `"—"` döner, çağıran tarafta elle null kontrolü gerekmez. Saat içermeyen bir değere `formatDateTime` verilirse yalnızca tarih döner.
  **Dönem seçicilerinin kaynağı da bu dosyadır:** `getYearOptions()` (içinde bulunulan yıl dahil son 5 yıl), `getMonthOptions(year)` (içinde bulunulan yılda bu ayda biter) ve `clampMonth(year, month)`. Bunu kullanan üç sayfa var: `Apartments`, `Transactions`, `Reports`. Sonucu bir kuraldır: **gelecek bir dönem arayüzden seçilemez**, bu da §8 kural 2'nin kullanıcıya bakan yüzüdür. Asıl sınır burada değil `dues/handlers.js`'in `validatePeriod`'ündedir, buradaki seçiciler onun UI karşılığıdır. Yeni bir yıl/ay seçici yazarken listeleri elle üretme ve ay değişimini `clampMonth`'suz bırakma.
  **Para** için `src/utils/currency.js` → `formatCurrency(value)`. Tek biçim `1.250,00 ₺`'dir (tr-TR, her zaman iki hane kuruş), geçersiz girdide `"—"` döner. Sayfa içinde `toLocaleString("tr-TR")` ile elle para formatlama.
- **Sabitler:** paylaşılan bir `utils/constants.js` **yoktur**. Her sabit onu kullanan modülde tanımlanır (`THEME_KEY` → `useTheme.js`, `SESSION_USER_KEY` → `useCurrentUser.js`). Birden fazla modülden kullanılan sabit, sahibi olan modülden export edilir. Sabitler için ayrı bir çöplük dosyası açma.
- **Tema:** light/dark, `style.css` içindeki CSS değişkenleri. Bileşen CSS'lerinde renkleri değişken üzerinden kullan, hex sabitleme.
  - **İlk temayı `public/theme-init.js` çözer, `useTheme` değil.** `<head>`'deki bu klasik script `localStorage` ve `prefers-color-scheme` sırasıyla bakıp `data-theme`'i **ilk boyamadan önce** yazar. `useTheme` başlangıç değerini `document.documentElement.dataset.theme`'den geri okur, kendi `localStorage` okuması yoktur. Aksi hâlde `:root` varsayılanı koyu olduğu için açık tema kullanan kullanıcı her açılışta koyu bir kare görür, çünkü `data-theme`'i yazan `useLayoutEffect` ancak `Footer` mount olduğunda çalışır. Script'in yeri `public/`'tir ve modül değildir, çünkü `src/` altındaki bir modül ertelenir ve o boyamadan sonra çalışır.
  - **`theme` anahtarı iki dosyada geçer:** `public/theme-init.js` (okuma) ve `src/hooks/useTheme.js` (yazma, `THEME_KEY`). İki taraf ayrı modül sistemlerinde olduğu için ortaklaştırılamaz, biri değişirse diğeri de değişmelidir.
  - **Değişken eşiği:** yeni bir CSS değişkeni yalnızca gerçekten gerekliyse tanımlanır. Bir değer aynı dosyada birden fazla yerde kullanılıyorsa ya da temaya göre değişiyorsa değişken olur, tek yerde geçen ve temadan bağımsız bir değer için literal yaz.
  - **Temalar arası tek fark renktir.** İki tema aynı değişken setini aynı anahtarlarla tanımlar. Bunu garantilemek için geometri (offset, blur, spread, `1px solid`, katman sayısı) kuralın içinde literal yazılır ve değişken **yalnızca rengi taşır**: `box-shadow: 0 3px 16px var(--x-glow)` doğru, `box-shadow: var(--x-glow)` yanlıştır. Aynı sebeple `[data-theme="light"]` altında yapısal override yazma, yalnızca değişken değeri ezilir.
  - Boşluk ve köşe yarıçapı için token ölçeği yoktur, literal px kullanılır. `style.css` yalnızca global reset, tema değişkenleri ve temel eleman stillerini barındırır, paylaşılan `.u-*` yardımcı sınıfı yoktur.
  - **Bileşen renkleri değişken sözleşmesiyle geçirilir.** `PasswordStrength` `--pw-*`, `FormField` `--ff-*` ailesini kullanır ve her sayfa bu eşlemeyi **kendi kök sınıfında** yapar (`.setup-page-bg`, `.recover-page-bg`), `:root`'ta yapmaz. Tüm sayfa CSS'leri tek bundle'da toplandığı için `:root` tanımları birbirini ezer. Dış boşluk bileşende değil sayfa CSS'inde kalır.
- **Koşullu mesajlara yer ayrılmaz.** Hata mesajı, doğrulama uyarısı ve ipucu satırı koşullu render edilir (`{error && <div .../>}`). Boşken yer tutan sabit yükseklikli yuva açılmaz. Mesaj belirince alttaki içeriğin kayması kabul edilen bedeldir. **İstisna:** Caps Lock göstergesi, alan içi rozet olarak konumlandığı için zaten akışta yer kaplamaz.
- **Şifre alanları.** Her şifre girişi `CapsLockIndicator` içerir (alan içinde, göster/gizle butonunun solunda beliren "Büyük Harf" rozeti). Durum takibi bileşenin kendi `useCapsLockOn()` hook'undadır, sayfa kendi `capsLockOn` state'ini tutmaz ve input'a olay bağlamaz. Hook `document` üzerinde dinler, alan `onBlur`'ünde sıfırlama yapılmaz. Uyarı kutulu bir hata bloğu değildir, zeminsiz rozettir. Tam cümle `title` ve `aria-label`'dadır. Göster/gizle her alanda ayrı state ile çalışır.
- **Giriş ekranlarının form alanı** paylaşılan `FormField` bileşenindedir (ikon + floating-label + isteğe bağlı şifre göster/gizle + Caps Lock rozeti + isteğe bağlı `hint`). Floating-label kurulumu: `<label>` input'un **kardeşi ve DOM'da ondan sonra** gelir, input `placeholder` taşımak zorundadır (`:not(:placeholder-shown)` çalışsın diye) ve dolgu üstten kalın alttan incedir.
- **Okunabilirlik (hedef kitle).** Kullanıcıların çoğunluğu 40+ yaş apartman yöneticileridir. **Alt sınır 1rem'dir:** gövde, etiket, giriş alanı, buton ve tablo hücresi metni bunun altına inmez. Uzun bir metni tek satıra sığdırmak için fontu küçültme, metni sar ya da kapsayıcıyı genişlet.
  - **Uygulama politikası:** Eski sayfalarda 1rem altı tanımlar hâlâ vardır ve bilinçli olarak toplu düzeltilmemiştir, çünkü yoğun tablo sayfalarında satır yüksekliği ve sütun genişliği değişir. Kural **yeni yazılan koda derhal uygulanır**, eski sayfalar o sayfaya dokunuldukça yükseltilir. Kalan ihlallerin sayısı burada tutulmaz, güncel durum için `grep -rE "font-size:\s*0\.[0-9]+rem" src` yeterlidir.
  - Rozet metinleri (Caps Lock rozeti, floated etiket, sürüm rozeti, `kbd` tuş kapağı) bu sınırdan ayrı değerlendirilir.
  - Kural `src/` dışındaki HTML pencerelerinde de geçerlidir (`guide.css`, `splash.css`).

### Rotalar

Koruma iki katmandır: `ProtectedRoute` (girişli/girişsiz) ve `RequireBuilding` (seçili bina var mı).

| Rota               | Bileşen         | Koruma                                                                                        |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `/login`           | Login           | guestOnly                                                                                     |
| `/setup`           | Setup           | guestOnly, yalnızca `needsSetup` iken                                                         |
| `/recover`         | Recover         | guestOnly, üç sayfa içi durum: kod → yeni şifre → sonuç                                       |
| `/select-building` | SelectBuilding  | auth. Bina seç/oluştur/adlandır/sil. Tek aktif bina varsa atlanır                             |
| `/dashboard`       | Dashboard       | auth + bina                                                                                   |
| `/add-apartment`   | AddApartment    | auth + bina                                                                                   |
| `/apartments`      | Apartments      | auth + bina. Aidat listesi + tahsilat/düzenle/pasife al/toplu aidat                           |
| `/residents`       | Residents       | auth + bina                                                                                   |
| `/add-income`      | AddIncome       | auth + bina                                                                                   |
| `/add-expense`     | AddExpense      | auth + bina                                                                                   |
| `/transactions`    | Transactions    | auth + bina                                                                                   |
| `/reports`         | Reports         | auth + bina                                                                                   |
| `/profile`         | Profile         | auth. Bina **gerekmez**, hesap sayfasıdır. "Aktif Bina" satırı ve "Geri Dön" hedefi uyarlanır |
| `*`                | StartupRedirect | Oturuma ve `needsSetup`'a göre yönlendirir                                                    |

**Hesap menüsü (`AccountMenu`)** tüm korumalı sayfalarda, sağ üstte bulunur: Profilim, Bina Değiştir, ayraç, Çıkış Yap. Menünün prop'u yoktur, her sayfada aynı öğeleri gösterir. Yerleşim kuralı: sayfanın başlık satırı zaten `space-between` bir flex ise menü o satırın sağ ucuna girer, değilse başlığın üstüne paylaşılan `.account-menu-row` ile kendi satırında durur. Dışarı tıklama ve Escape menüyü kapatır. Etiket `managerName`, yoksa `username`'dir.

---

## 12. Güvenlik Kuralları

- `nodeIntegration:false`, `contextIsolation:true`, `webSecurity:true`. Değiştirme. `sandbox:false` yalnızca ana pencerenin preload'unun CommonJS `require` ihtiyacı içindir.
- Preload'da **whitelist dışı kanal çağrısı fırlatır** (`safeInvoke`/`safeOn`). Yeni kanal eklenmeden preload'dan çağrılamaz.
- Handler hataları renderer'a jenerik mesajla döner, stack ve iç detay **asla** UI'a sızdırılmaz.
- Şifre ve kurtarma kodu asla loglanmaz, asla renderer'a düz metin dönülmez. Tek istisna kurtarma kodudur, üretildiği anda bir kez gösterilir.
- Harici URL açma yalnızca `shell.openExternal` ile ve sabit URL'lerle yapılır.
- Uygulama offline'dır, tek ağ trafiği `electron-updater`'ın GitHub Releases kontrolüdür.
- **Her pencerenin HTML'i kendi CSP `<meta http-equiv>` etiketini taşır** ve üçü birbirinden bağımsızdır: `index.html` (dev sunucusuyla konuştuğu için `connect-src`'de localhost taşır), `splash.html` ve `guide.html` (ikisi de `default-src 'none'` tabanlı). Yeni bir pencere HTML'i eklerken CSP'sini de ekle.
- **`index.html`'in `connect-src`'i yalnızca dev içindir ve paketli sürüme gitmez.** `vite.config.js`'teki `tighten-csp` eklentisi build sırasında direktifi `connect-src 'self'` yapar. Renderer'da `fetch`, `blob:` ve `Worker` kullanımı yoktur, jsPDF çıktısı `arraybuffer` olarak IPC'ye verilir, yani paketli sürümde dışarıya açılan tek şey `electron-updater`'ın main process'teki kontrolüdür.
- **`style-src 'unsafe-inline'` kaldırılamaz.** SweetAlert2 çalışma zamanında kendi `<style>` etiketini enjekte eder ve React'in inline `style` prop'ları da bu direktife tabidir. Kaldırılırsa dialoglar stilsiz kalır.
- **`base-uri` ve `form-action` `default-src`'ye dahil değildir**, bu yüzden `index.html`'de ayrıca yazılıdır (`base-uri 'self'`, `form-action 'none'`). `frame-ancestors` meta etiketinde yok sayılır, oraya yazma. Electron paketlenmemiş sürümde CSP'siz her renderer için konsola uyarı basar ve bu uyarı `main.log`'a da düşer. Denetim yanıt başlığıyla giderilemez, politika sayfanın kendisinde olmalıdır.

---

## 13. Hata Yönetimi ve Loglama

- **Main process:** `electron-log`. Kurulumun tamamı `electron/errorReporting.js`'tedir, `main.js` yalnızca `initLogging(getMainWindow)` çağırır. Log dosyası `%APPDATA%/mavikent-site-yonetimi/logs/main.log`'tur, boyut sınırı 5 MB'tır.
- **`log.initialize({ preload: false })` bilinçlidir.** Paketin varsayılanı her session'a kendi preload dosyasını enjekte eder, bu projede renderer electron-log'u hiç import etmez ve üç pencereye de ölü bir preload yüklenirdi.
- **`console` electron-log'a bağlıdır.** `initLogging()` `Object.assign(console, log.functions)` çağırır, böylece main process'teki her `console.warn/error` main.log'a da yazılır. **Bu satır olmadan `log.initialize()` main process console'unu yakalamaz.** Satırın `require("electron-log")`'tan **sonra** gelmesi zorunludur, sıralama bozulursa sonsuz döngü oluşur.
- **Log dosyasının yolu sabit tutulmaz**, `log.transports.file.getFile().path` ile paketin kendisinden okunur. `getFile()` dosyayı oluşturmaz, yalnızca yolu çözer. Varlığını `initLogging`'in son satırındaki açılış kaydı garantiler: `[Main] Starting v<sürüm> (packaged|dev)`. main.log'un ilk satırı budur.
- **Ölümcül hata kutusu tek yerden üretilir: `showFatalError(title, message, whatToDo, parentWindow?)`.** Üç çağıranı vardır: DB açılamaması, açılış hatası ve yakalanmamış hata. Kutu üç parça taşır: ne olduğu, **kullanıcının ne yapacağı** ve bir "Kayıt Dosyasını Göster" butonu (`shell.showItemInFolder`) + `SUPPORT_EMAIL` adresi. **Kural: kullanıcıya yalnızca dosya yolu yazan kutu kurma.** 40+ hedef kitle için `%APPDATA%` altındaki bir yolu elle bulmak eylem değildir. `app.isReady()` false iken butonlu kutu kullanılamaz, o yolda `showErrorBox` kullanılır.
- **Kutu mümkünse ana pencereye bağlanır.** Aksi hâlde Windows'ta ana pencerenin arkasına düşüp uygulamayı donmuş gösterebilir. Pencereyi `initLogging`'e verilen resolver sağlar. **Resolver parametre olarak geçirilir, `errorReporting.js` `windows/main`'i import etmez:** `windows/main` → `menu.js` → `errorReporting.js` zinciri zaten var, ters yönde import döngü kurar.
- **`startCatching` kendi diyaloğunu göstermez.** `{ showDialog: false }` ile çağrılır ve yerine Türkçe bir `onError` kutusu gösterilir, çünkü paketin varsayılanı gövdesi ham stack trace olan İngilizce bir kutu açar. `onError` yalnızca `uncaughtException` için kutu açar, `rejection` içeren hata adlarında sessiz kalır. Hatayı **kendisi loglar** ve her zaman `false` döner: paket `onError`'ı dosyaya yazmadan önce çağırdığı için, bloklayan modal açıkken log dosyasında raporlanan hata bulunmuyordu. `false` dönüşü paketin kendi loglamasını atlar, aksi hâlde aynı hata iki kez düşer.
- **Ölümcül kutu süreç ömrü boyunca bir kez açılır** (`fatalErrorShown` bayrağı, yalnızca `onError` yolunda). Tekrar eden bir kaynaktan gelen hata aksi hâlde her tekrarda yeni bir senkron kutu açar ve kullanıcı uygulamayı kapatamaz.
- **Handler'lar:** `console.error("[<domain>.handlers] <channel>:", err)` deseni. Bu log ortak `createHandle` zarfı tarafından otomatik üretilir, handler içinde elle try/catch yazılmaz.
- **Servisler:** beklenen iş kuralı ihlalinde `{ success:false, message }` döner, beklenmeyen hatayı kendi `try/catch`'inde yakalar, loglar ve sabit bir Türkçe mesaja çevirir. Programcı hatası koruları **İngilizce** mesajla `throw` eder, çünkü kullanıcıya hiç ulaşmazlar.
- **Renderer:** hata mesajı SweetAlert ile gösterilir. Renderer'da ayrı bir log altyapısı yoktur, ama renderer konsoluna düşen `error` ve `warning` satırları main tarafından yakalanıp main.log'a yazılır (`catchRendererConsole`, `[Renderer] <mesaj> (<kaynak>:<satır>)` biçiminde). Yakalayıcı `app.on("web-contents-created")` ile kurulur, yani üç pencereyi de kapsar ve `src/` tarafında hiçbir kod gerektirmez. `info` ve `debug` bilinçli olarak alınmaz. Bu yol konsol metnini alır, yapısal stack trace vermez. React ağacındaki hatalar ayrıca `ErrorBoundary` ile yakalanır ve kullanıcıya kopyalanabilir detayla gösterilir.
- Log mesajları İngilizce prefix + açıklama şeklindedir. Prefix modülü tanıtır: `[Main]`, `[Migrate]`, `[Database]`, `[Updater]`, `[Splash]`, `[MainWindow]`, `[Guide]`, `[Renderer]`, `[<domain>.handlers]`, `[<domain>.service]`. Renderer bileşenleri kendi adını prefix yapar (`[ErrorBoundary]`, `[Footer]`) ve bu satırlar main tarafından `[Renderer]` başlığıyla sarılarak main.log'a düşer.
- **Hata nesnesi olduğu gibi loglanır, `err.message` değil.** `console.error("[Main] Backup failed:", err)` doğru, `..., err.message)` yanlıştır. İkincisi stack'i atar ve log satırı hatanın nerede oluştuğunu söylemez. Gerçek bir arıza anında (yedekleme, geri yükleme, güncelleme) elimizdeki tek kanıt bu satırdır. Aynı sebeple `catch` bloğunu hata nesnesini yakalamadan yazma (`catch {`).

---

## 14. Performans Kuralları

- better-sqlite3 senkrondur, IPC handler'ları hızlı tutulmalıdır. Ağır rapor sorgularında index kullan.
- Listeleri renderer'da filtrelemek yerine SQL'de filtrele (özellikle Transactions büyüdükçe).
- Sayfalar lazy-load'dur, yeni sayfa eklerken aynı deseni koru.
- `app.disableHardwareAcceleration()` bilinçlidir (eski donanımlarda render sorunlarını önler). Kaldırma.
- Büyük PDF üretimi renderer'da yapılır, UI donmasını önlemek için üretim öncesi loading göstergesi kullan.

---

## 15. Build, Dağıtım ve Release

```bash
npm run dev            # Vite + Electron eş zamanlı (concurrently + wait-on)
npm run start          # Sadece Electron (önceden build edilmiş dist/ ile)
npm run build          # Vite production build
npm run preview        # Vite'ın dist/ önizleme sunucusu (tarayıcıda, electronAPI yoktur)
npm run dist           # Vite build + electron-builder (NSIS installer → dist_electron/)
npm run rebuild        # Native modülleri (better-sqlite3) Electron ABI'sine yeniden derle
npm run lint           # ESLint
npm run reset-db       # Dev DB dosyalarını siler → fresh install + /setup akışı
npm run reset-appdata  # Paketli sürümün %APPDATA% verisini siler
```

### Release Adımları (kullanıcı onayıyla)

1. `package.json` → `version` yükselt (semver: bugfix=patch, özellik=minor).
2. **Yama notları (`src/utils/releaseNotes.js`) güncellenmeli.** Footer'daki "Sürüm Notları" modalında gösterilir. Kural: **yalnızca son 3 yama** listede kalır, yeni sürümü diziye başa ekle ve en eski kaydı sil. Her kayıt `{ version, date (YYYY-MM-DD), title, changes: [...] }` biçimindedir, `version` `package.json` ile aynı olmalıdır ve `changes` kullanıcıya dönük kısa Türkçe maddelerdir.
3. Commit mesajı geleneği: `feat: vX.Y.Z — kısa Türkçe açıklama` ya da `fix: vX.Y.Z — ...`.
4. `npm run dist` → `dist_electron/Mavikent-Site-Yonetimi-Setup-X.Y.Z.exe`.
5. GitHub Release oluştur (tag `vX.Y.Z`). `electron-updater` `latest.yml` ve installer'ı release asset'lerinden okur.

### Güncelleme Akışları (`electron/autoUpdater.js`)

Modül gövdesinde `autoUpdater.logger = log` ve `autoUpdater.autoInstallOnAppQuit = false` atanır. `main.js` ve `menu.js` `electron-updater`'ı hiç import etmez.

**Açılışta (`runStartupUpdateFlow`).** Splash'e bağlıdır ve olay dinleyicileriyle çalışır. Kontrol için `CHECK_TIMEOUT_MS`, indirme için `DOWNLOAD_STALL_TIMEOUT_MS`'lik bir ilerlemesizlik watchdog'u vardır, yani internet yoksa ya da yavaşsa uygulama açılmaya devam eder. Akış bittiğinde tüm dinleyiciler kaldırılır. Kullanıcı "Şimdi Yeniden Başlat" derse `quitAndInstall` çağrılır, hata verirse loglanıp açılışa devam edilir (aksi hâlde splash sonsuza kadar açık kalır). `checkForUpdates()` çağrısı `.catch(() => {})` ile kapatılır ve bu bilinçlidir: `electron-updater` hatayı hem `error` olayıyla yayınlar hem promise'i reddeder, yani hata zaten dinleyicide loglanır.

**`autoInstallOnAppQuit = false`** paketin varsayılanının tersidir: "Daha Sonra" diyen kullanıcı o oturumda mevcut sürümü kullanmaya devam eder ve indirilmiş güncelleme uygulama kapatılınca sessizce kurulmaz. Kurulum yalnızca kullanıcı açıkça yeniden başlatmayı seçtiğinde olur. İndirilen dosya önbellekte kalır.

**Menüden (`runOnDemandUpdateFlow(mainWindow)`).** Yardım → Güncellemeleri Kontrol Et. Akış açılış akışından ayrıdır ve **olay dinleyicisi kullanmaz**, çünkü `autoUpdater` olayları global'dir ve açılış akışı kendi dinleyicilerinin tamamını kaldırır. `checkForUpdates()` `CHECK_TIMEOUT_MS`'lik bir `setTimeout` promise'i ile `Promise.race`'e sokulur. Sınır gereklidir, çünkü `electron-updater`'ın kendi zaman aşımı bu ortamda çalışmaz (`request.on("socket")` üzerine kuruludur, Electron'un `net.ClientRequest`'i o olayı yaymaz) ve istek asılı kalırsa `isUpdateFlowActive` kalıcı olarak `true` kalır. İndirmeye süre sınırı konmaz. `downloadPromise`'in sonucu, kullanıcıya "indiriliyor" kutusu gösterilmeden **önce** `then(() => null, (err) => err)` ile ele alınır ve kutu kapandıktan sonra değerlendirilir, aksi hâlde kutu açıkken oluşan hata sahipsiz reddedilme olarak loglanır. `isUpdateFlowActive` bayrağı eşzamanlı ikinci akışı engeller. Menü öğesi **dev'de gösterilmez**, çünkü paketlenmemiş uygulamada `checkForUpdates()` ağa çıkmadan `null` döner ve akış yanlışlıkla "Uygulamanız güncel." yazar.

### Renderer Build Ayarları (`vite.config.js`)

Vite yalnızca renderer'ı derler, main process paketlenmez ve Electron onu olduğu gibi yükler.

- **Dev portu üç yerde sabittir:** `vite.config.js` (`server.port` + `strictPort`), `package.json`'daki `wait-on http://localhost:5173` ve `electron/windows/main/index.js`'teki `DEV_SERVER_URL`. `strictPort` bu yüzden zorunludur, port kayarsa Electron ölü bir adrese bağlanır. Portu değiştiren üçünü birden değiştirir.
- **`build.target` Electron'un Chromium sürümüne sabitlenmiştir.** Tek çalışma ortamı Electron olduğu için Vite'ın tarayıcı tabanlı varsayılanı gereksiz downlevel üretir. Electron majör sürümü yükseltilirken bu değer de güncellenir, güncel karşılığı `grep -a -o "Chrome/[0-9.]*" node_modules/electron/dist/electron.exe` ile okunur.
- **`preview` bloğu yoktur**, `npm run preview` Vite'ın varsayılan portunda çalışır. Dev sunucusu açıkken preview'in porta takılmaması için böyledir.
- `build.sourcemap` **tanımlanmaz**. `vite build` config dosyasını yüklerken `NODE_ENV` değerini zaten `production` yapar, yani `NODE_ENV`'e bakan bir koşul her zaman aynı dala düşer.
- `server.watch.ignored` `dist_electron/` ve `database.db*` dosyalarını izleme dışında tutar, ikisi de build girdisi değildir ve sık değişir.
- **`tighten-csp` eklentisi yalnızca build'de çalışır** (`apply: "build"`) ve `index.html`'in `connect-src` direktifini `'self'` ile değiştirir (§12). Dev'de dosya olduğu gibi kalır, aksi hâlde HMR websocket'i CSP'ye takılır.

### Build Ortam Notları (Windows)

- NSIS build'i `TMP=C:\WINDOWS\TEMP` gibi anormal temp değişkenlerinde bozulur. Build öncesi TMP/TEMP'in kullanıcı temp'ine işaret ettiğini doğrula.
- `setAppUserModelId` çağrısı görev çubuğu ikonunun boş çıkmasına neden olmuştu. Ekleme.
- `asarUnpack: **/*.node` zorunludur, better-sqlite3 native binary'si asar dışında kalmalıdır.

---

## 16. Debugging Notları

| Sorun                        | Bakılacak yer                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Uygulama açılmıyor (prod)    | `%APPDATA%/mavikent-site-yonetimi/logs/main.log`                                             |
| "Blocked IPC channel" hatası | Kanal `channels.js`'te tanımlı mı, preload güncellenmiş mi                                   |
| Migration hatası             | `main.log` + `migrations` tablosu içeriği. Migration transaction'ı rollback olur             |
| DB kilitli (Windows)         | WAL dosyaları + başka instance kontrolü. `busy_timeout=3000` vardır                          |
| Dev'de sıfırdan başlama      | `npm run reset-db` (üç dosyayı birden siler, tek tek silme)                                  |
| DevTools                     | Menü → Görünüm → Geliştirici Araçları (yalnızca dev, F12)                                    |
| Güncelleme testi             | Yalnızca paketli sürümde çalışır. Dev'de hem açılış kontrolü atlanır hem menü öğesi gizlenir |

---

## 17. Hızlı Rehber

Yeni bir görevde izlenecek sıra:

1. **Görev bir sayfa ya da UI işi mi?** → `src/pages/<Sayfa>/` içinde çalış, veri ihtiyacı varsa mevcut `electronAPI` metodlarına bak (§10).
2. **Yeni veri ya da endpoint mi gerekiyor?** → Önce kullanıcıya sor (§3). Onaylanırsa §5.2'deki 4 dosya adımını izle, doğrulamayı handler'da yaz ve şema kısıtlarıyla parite kur (§9).
3. **Şema değişikliği mi?** → §7.3 tablosuna göre migration + schema çiftini birlikte güncelle, iş kurallarını (§8) ihlal etmediğini kontrol et.
4. **Emin olmadığın davranış mı var?** → Tahmin etme, ilgili `service.js`'i oku. İş mantığının tek doğruluk kaynağı koddur, bu doküman haritadır.
5. **Bitirirken:** değişen davranışı bu dokümanda güncelle, tamamlanan ROADMAP maddesini `ROADMAP.md`'den sil.

Sık yapılan hatalar (yapma):

- Kanal string'ini elle yazmak (sabiti import et)
- Yalnızca schema'yı ya da yalnızca migration'ı güncellemek (ikisi birlikte)
- `dues`/`incomes`/`expenses` kaydını DELETE etmek (iptal mekanizması kullan)
- Renderer'dan `require` ya da Node API kullanmaya çalışmak
- SweetAlert'i doğrudan çağırmak (`utils/alert.js` kullan)
- Yorumda kodun ne yaptığını tekrar etmek ya da yorumu Türkçe yazmak (yorum İngilizcedir ve nedeni anlatır, §3)
- `showAlert.confirm` sonucunda `result.isConfirmed` beklemek (metod boolean döner, §11)
- `buildingId` filtresi olmadan bina verisi sorgulamak
- Handler içinde elle try/catch yazmak (`createHandle` zarfını kullan, §5.2)
- Modül gövdesinde `const db = getDb()` yazmak (bağlantı henüz açılmamıştır, §7.4)
- Metin alanını service'te tekrar trim'lemek (normalizasyon handler'da tek yerdedir, §9), şifreyi trim'lemek
- Service'te `err.message`'ı renderer'a döndürmek ya da iş kuralı ihlalini `transaction` içinden `throw` etmek
- `catch` bloğunu hata nesnesini yakalamadan yazmak (`catch {`), log satırı arıza anındaki tek kanıttır (§13)

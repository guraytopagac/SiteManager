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

| Yol                 | Neden                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `package-lock.json` | Çözülmüş bağımlılık ağacı. Sürüm sorusunun cevabı `package.json`'dadır |
| `assets/`           | İkili varlıklar. Dosya adı bilgi verir, içeriği vermez                 |

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
- **Stil:** Prettier. `.prettierrc` tek alan taşır: `printWidth: 120`. Satır sonu ayarı **yazılmaz**, varsayılan `endOfLine: "lf"` geçerlidir ve çalışma kopyasının tamamı LF'tir. Eski `"auto"` değeri bilinçli olarak kaldırıldı, çünkü dosyadaki satır sonu ne ise onu kabul eder ve CRLF'e kayan bir dosya hiçbir zaman `--check`'e düşmezdi. Depoda `.gitattributes` yoktur (bilinçli), satır sonu bunun yerine **depo yerel git ayarıyla** sabitlenmiştir: `core.autocrlf = input` (`.git/config`). Git böylece checkout'ta CRLF yazmaz, commit'te LF'e çevirir. Windows'ta global varsayılan `true`'dur ve bu yerel ayar olmasa her dosya CRLF checkout edilir, `format:check` de tüm depoyu sapma gösterirdi. **Yerel ayar klonlanmaz:** yeni bir makinede ya da sıfırdan klonlanan bir kopyada `git config core.autocrlf input` bir kez çalıştırılmalıdır. Kalan sapma **toplu düzeltilmez**: dokunulan dosya o değişiklikle birlikte biçimlendirilir. Güncel sapma listesi için `npm run format:check`, sayıyı buraya yazma.
- **Lint:** ESLint (`eslint.config.mjs`), `npm run lint`. Bilinmesi gerekenler:
  - **`no-console`** yalnızca `console.error` ve `console.warn`'a izin verir, bu yüzden bilgi amaçlı log satırları da `warn`'dır. **`no-unused-vars`** hata seviyesindedir ve yalnızca `^_` ile başlayan argümanları muaf tutar. Bunların yanında `eqeqeq` (`smart`, yani validasyon katmanındaki bilinçli `== null` kontrolleri serbest), `no-var`, `prefer-const` ve `no-unused-expressions` tüm bloklarda açıktır.
  - **Dört blok vardır ve her biri hem globals hem `sourceType` taşır:** `src/**` browser + ESM, `electron/**` + `database/**` Node + `commonjs`, `guide.js` + `splash.js` + `public/*.js` browser + `script`, kökteki config dosyaları (`*.js`, `*.mjs`) Node + ESM. `sourceType` bilinçlidir, "modül sistemini karıştırma" kuralını mekanik hale getirir: CommonJS bir dosyaya ya da klasik script'e yazılan `import`, lint'te parse hatası verir. Klasik script listesinin sahibi `BROWSER_SCRIPTS` dizisidir ve iki yerde kullanılır (kendi bloğu ve Node bloğunun `ignores`'ı), yeni bir pencere script'i oraya yazılır.
  - **Kök config bloğu olmadan `vite.config.js` ve `eslint.config.mjs` hiçbir bloğa uymaz** ve tek kural bile uygulanmadan lint edilmiş sayılır. Doğrulaması `npx eslint --print-config vite.config.js` çıktısındaki `rules` alanıdır.
  - **`no-restricted-imports` iki doküman kuralını lint'e taşır:** renderer `electron`, `fs`, `path`, `better-sqlite3` ve `node:*` import edemez (§12), `sweetalert2`'yi ise yalnızca `src/utils/alert.js` import edebilir (§11). İkinci muafiyet ayrı bir blokla verilir, o blok Node kısıtlarını korur.
  - `node_modules` ESLint tarafından zaten yok sayılır, `globalIgnores` içinde tekrar edilmez.
- **Naming:** değişkenler `camelCase`, React bileşenleri `PascalCase`, sabitler `UPPER_SNAKE_CASE`, IPC kanal string'leri `domain:kebab-case`.
- **Dosya adları:** JS/CSS modülleri `camelCase` (`autoUpdater.js`, `errorReporting.js`, `themeInit.js`), React bileşenleri ve kendi klasörleri `PascalCase` (`AccountMenu/AccountMenu.jsx`). **Dosya adında tire kullanılmaz**, kebab-case yalnızca IPC kanal string'lerine aittir. Tek istisna `database/` altındaki numaralı SQL dosyalarıdır (`05_dues.sql`, `001_resident_date_range.sql`), orada sıra öneki ve snake_case bilinçlidir.
- **Modül sistemi:** `electron/` ve `database/` CommonJS (`require`), `src/` ESM (`import`). Karıştırma.
- **Import sırası** (CommonJS dosyalarda): 1) Node builtin, 2) external paketler, 3) local. Her grup kendi içinde alfabetik.
- **Import alias:** `src/` içinde `@` → `src/` alias'ı tanımlıdır (`vite.config.js`). Kural yönle belirlenir: **klasör dışına çıkan her import `@/...` yazılır** (`@/hooks/useTheme`, `@/utils/alert`), uzantısız. Göreli yol yalnızca iki yerde kalır ve ikisi de bilinçlidir: aynı klasördeki ya da bir üstteki kardeş dosyalar (`./useDues`, `../constants`, dosyanın kendi klasörüne ait olduğunu gösterir) ve `src/` dışına çıkan varlıklar (`../../../assets/app-logo.webp`, alias `src/`'yi gösterdiği için oraya erişemez). `src/` kökündeki `main.jsx` ve `App.jsx` de göreli kalır, orada `./components/...` ile `@/components/...` aynı derinliktedir. **Uzantı kuralı yola bakmaz:** göreli importlar da `.js`/`.jsx` uzantısı taşımaz, Vite'ın çözümleyicisi ikisini de kapsar. Tek istisna CSS'tir (`./Footer.css`), orada uzantı zorunludur.
- **Prop doğrulaması yoktur** (TypeScript de yok, `prop-types` de yok). React 19 `propTypes` denetimini paketten çıkardı, tanımlar sessizce yok sayılıyordu. Yeni bileşene `propTypes` **ekleme**, prop sözleşmesini destructuring imzasından ve varsayılan değerlerden okunur tut.
- **Yorumlar yalnızca `electron/` ve `database/` içinde bulunur.** Başka hiçbir yerde yorum satırı yoktur: `src/`, `public/` ve kökteki config dosyaları (`vite.config.js`, `eslint.config.mjs`) yorumsuzdur, CSS bölüm ayracı da yazılmaz. Sınır dosya yoluyla çizilir, çünkü main process kodu Electron'un davranışına dayanan yerel kararlar taşır ve o gerekçe kodun yanında durmalıdır. Renderer'da böyle bir katman yoktur, oradaki her gerekçenin yeri bu dokümandır. İki izinli klasörde yorum `//` ile ve İngilizce yazılır, kodun **ne yaptığını değil neden öyle olduğunu** anlatır: dosyanın başında modülün ne olduğunu söyleyen bir ya da iki satır, gövdede yalnızca kolay yanlış anlaşılan kararların gerekçesi. Kendini anlatan satırın üstüne yorum konmaz.

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
- Renderer'a Node API açma (preload whitelist dışına çıkma). `src/**` içinde `electron`, `fs`, `path`, `better-sqlite3` ve `node:*` importları lint'te de yasaktır (§3)
- `dues` / `due_payments` / `incomes` / `expenses` kayıtlarını fiziksel silme (§8)

---

## 4. Klasör Yapısı

```
SiteManager/
├── assets/              # app-icon.ico (dört pencere + menü), splash-download.svg ve
│                        #   backgrounds/splash main process'e, backgrounds/login ile
│                        #   backgrounds/setup yalnızca src/'e aittir. app-logo.webp ikisinde
│                        #   birden: splash.html ham dosyayı, Login ve Setup import ettikleri
│                        #   Vite kopyasını kullanır (§15). Dosya adı kullanıldığı yeri söyler,
│                        #   arka planlar klasörünün adını taşır: <klasör>-<tema>-bg.jpg
├── public/              # Vite'ın olduğu gibi kopyaladığı statikler. Bugün tek dosya:
│                        #   themeInit.js, ilk boyamadan önce çalışan tema script'i (§11)
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
    ├── components/      # AccountMenu, AuthField, ErrorBoundary, Footer, PageLoader,
    │                    #   PasswordStrength
    ├── hooks/           # session.js (oturum + seçili bina + kurulum durumu), useTheme
    ├── pages/           # Her sayfa kendi klasöründe (JSX + CSS), App.jsx'te lazy-load
    ├── utils/           # alert.js, date.js, currency.js, passwordStrength.js, releaseNotes.js
    ├── App.jsx          # Rotalar + StartupRedirect + RequireGuest/RequireAuth/RequireBuilding
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

**Tek hesap modeli.** Uygulamada rol yoktur, bir makinede bir hesap vardır. Bu hesap binaları yönetir, kendi kurtarma kodunu tutar ve gerektiğinde devredilir. Kullanıcıya dönük etiket "Site Yöneticisi"dir. Hesabın kişi adı `manager_name`'de tutulur, kurulumda girilir ve `useSession().managerName` ile gösterilir. Tek hesap olduğundan servisler satırı `ORDER BY id LIMIT 1` ile bulur.

- Şifreler `bcryptjs` ile hash'lenir, düz metin hiçbir yerde saklanmaz ya da loglanmaz.
- **Oturum:** `sessionStorage` → `session` anahtarı. Tek doğruluk kaynağı `src/hooks/session.js`'tir ve o anahtar altında tek bir `{ user, building }` nesnesi durur. `useSession()` reaktif okumanın tek yoludur, `setSession(user)` login sonrası yazar, `clearSession()` logout'ta kullanıcıyı ve seçili binayı birlikte siler (§11). **Kural:** `sessionStorage.setItem/removeItem` yazma, helper'ları kullan.
  - **Hook'un adı bilinçli olarak `useSession`'dır, `useCurrentUser` değildir.** Store'un cevapladığı ilk soru "oturum açık mı", ikinci soru "hesabın görünen alanları neler"dir. Tek hesaplı bir uygulamada "hangi kullanıcı" diye bir soru yoktur, o yüzden ad oturumu anlatır. `useCurrentBuilding` ise adını hak eder, çünkü bina gerçekten birden fazladır.
- **Kalıcı oturum ("Beni hatırla") yoktur.** Oturum yalnızca `sessionStorage`'dadır, uygulama kapanınca silinir.
- **Rota koruması:** `RequireGuest` girişli kullanıcıyı `/select-building`'e atar, `RequireAuth` girişsizi `/`'e atar. Bina gerektiren sayfalar ayrıca `RequireBuilding` altındadır (§11).

### İlk Kurulum (Setup)

1. Taze kurulumda `users` boştur, hesap satırı seed edilmez.
2. Renderer `getSetupState()`'i **açılışta bir kez** çağırır (`main.jsx`, mount'tan önce, §11). Hesap satırı yoksa `needsSetup:true` döner ve `/setup`'a yönlenir. **Hesap satırının varlığı kurulumun tamamlandığı anlamına gelir**, ara bir "pending" durum yoktur.
3. Kullanıcı ad soyad + kullanıcı adı + şifre belirler → `completeSetup({ username, password, managerName })` hesabı `INSERT` ile oluşturur, kurtarma kodu üretilip **bir kez** gösterilir. Kod bir modalda değil sayfa içi "Kurulum Tamamlandı" durumunda gösterilir: kurtarma kodu + "Kodu Kopyala" + kullanıcı adı. Sayfa `/login`'e kendiliğinden yönlenmez, kullanıcı butona basar ve kullanıcı adı `location.state` ile Login'e taşınır.
4. Endpoint yalnızca hesap satırı **yokken** çalışır ve tek yazma yolu `INSERT`'tür. Sayfa render'da `needsSetup()`'a bakar, kurulum tamamlanmışsa `/login`'e yönlenir. Başarılı kurulumdan sonra `markSetupComplete(username)` çağrılır.

### Şifre Kurtarma

- Kurtarma kodu 16 karakterdir, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` alfabesinden (I/O/0/1 yok) üretilir ve `XXXX-XXXX-XXXX-XXXX` biçiminde gösterilir. `normalizeRecoveryCode` tire, boşluk ve küçük harfi tolere eder.
- `resetAccountPassword(recoveryCode, newPassword)` `/recover` sayfasından oturumsuz çağrılır. Kod **tek kullanımlıktır**, her kullanımda yenisi üretilir. Sayfa iki adımlıdır (1: kod, 2: yeni şifre + tekrar). Adım 1 `verifyRecoveryCode` ile kodu yan etkisiz doğrular, böylece kullanıcı şifreyi yazmadan hatayı görür. Nihai ve yetkili doğrulama yine `resetAccountPassword` içindedir, adım 1 yalnızca erken UX kontrolüdür.
- **Kullanıcı adı için ayrı kurtarma endpoint'i yoktur.** `resetAccountPassword` başarı yanıtında `username` da döner ve `/recover` üçüncü adımı (sayfa içi "Şifreniz Yenilendi" durumu) yeni kurtarma koduyla birlikte kullanıcı adını gösterir. Kod panoya otomatik yazılmaz, "Kodu Kopyala" butonu vardır.
- **Login otomatik doldurma:** `getSetupState` kurulum tamamlanmışsa `username` alanını da döndürür. Login bunu IPC ile sormaz, açılışta çözülmüş değeri `savedUsername()` ile okur ve `useState`'in başlangıç değeri yapar, odağı da şifreye alır. `location.state?.username` varsa ona öncelik verilir.
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

| Durum                                | Ne yapılır                                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yeni tablo                           | `database/schema/NN_tablo.sql` oluştur, numarayı referans verdiği tüm tablolardan sonraya koy. Hepsi `IF NOT EXISTS` olduğu için mevcut kurulum etkilenmez     |
| Mevcut tabloya sütun/index/trigger   | `database/migrations/NNN_english_description.sql` **VE** ilgili `schema/` dosyasını aynı hale getir. Fresh install ile mevcut kurulum aynı şemada buluşmalıdır |
| CHECK constraint değişikliği         | SQLite `ALTER ... CHECK` desteklemez, tablo yeniden oluşturma migration'ı gerekir                                                                              |
| Tablo silme ya da yeniden adlandırma | Önce kullanıcıya sor                                                                                                                                           |

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
| Financial              | `addIncome` / `addExpense` (`{buildingId, amount, date, description, category}`), `getTransactions({buildingId, period})` (`period` = `{year, month}` ya da `null`, dönüşü `{data, totals:{totalIncome,totalExpense,net}}`, toplamlar SQL'de iptalsiz hesaplanır), `cancelIncome` / `cancelExpense` (`{id, buildingId, userId, reason}`)                                      |
| Report                 | `getReportData({buildingId, year, month})`, `saveReportFile({filename, buffer})` (`buffer` bir `Uint8Array`'dir, main tarafında `Buffer.from` ile yazılır; kullanıcı vazgeçerse `{success:false, cancelled:true}` döner). `getReportData` aidat satırları `apartment_id` taşır                                                                                                |
| Resident               | `getResidentsOverview({buildingId})`, `getResidentHistory({apartmentId, buildingId})`, `addResident({apartmentId, buildingId, ...sakin alanları})`, `updateResident({residentId, buildingId, ...sakin alanları})`, `moveOutResident({residentId, buildingId, moveOutDate})`                                                                                                   |
| System                 | `getAppVersion()` (ham string döner, `{success}` sözleşmesi dışındadır)                                                                                                                                                                                                                                                                                                       |

Kanal adları için tek kaynak `electron/ipc/channels.js`'tir. Tablonun grup sırası o dosyadaki alfabetik sırayı izler.

---

## 11. React / Renderer Mimarisi

- **Routing:** HashRouter (Electron `file://` ve `app://` uyumu için, BrowserRouter kullanma). Rotalar `App.jsx`'te, tüm sayfalar `lazy()` + `Suspense`.
- **State yönetimi:** Global state kütüphanesi **yoktur** (bilinçli karar, uygulama küçük). Sayfa state'i lokal `useState`/`useEffect`, oturum `sessionStorage` + `useSession`, seçili bina `sessionStorage` + `useCurrentBuilding`, tema `useTheme`.
- **Oturumun tamamı tek dosyada, tek store'dadır: `hooks/session.js`.** Kullanıcı ve seçili bina ayrı store'lar değil, aynı `{ user, building }` durumunun iki alanıdır. Aynı anahtarda saklandıkları ve çıkışta birlikte silindikleri için ayrı tutulmaları bir fabrika, bir kayıt defteri ve iki dosya gerektiriyordu, hiçbiri kalmadı. Durum **modül düzeyinde** tutulur, `useSession` ve `useCurrentBuilding` ise `useSyncExternalStore` ile kendi alanını seçen iki satırlık okuyuculardır: değer tek yerde okunur, kimliği yazmalar arasında sabit kalır ve mount ile abonelik arasında güncelleme kaçmaz. `useTheme` ile `AuthField`'ın dosya içi `useCapsLockOn`'u da aynı "modül düzeyinde tek kaynak" desenindedir, ama abonelikleri elle kurulmuştur.
  - **Tek yazma yolu `commitState(user, building)`'dir.** Dört yazma fonksiyonu (`setSession`, `setCurrentBuilding`, `clearCurrentBuilding`, `clearSession`) belleği, `sessionStorage`'ı ve aboneleri ayrı ayrı değil hep birlikte günceller. Dokunmadığı alanı `state`'ten okuyup geri yazar, yani bina yazmak oturumu düşürmez.
  - **Renderer alan süzmesi yoktur.** `setSession` gelen nesneyi olduğu gibi saklar, çünkü `auth/service.js`'in `toSafeUser()`'ı zaten yalnızca gösterilecek beş alanı döndürür. Aynı şekilde `setCurrentBuilding`'in üç çağrı yeri de `{ id, name }` yazar. Güvenlik sınırı main tarafındadır (§9), renderer'da tekrarlanmaz. Servis dönüşüne alan eklenirse süzmenin yeri yine `toSafeUser`'dır.
  - **`window` olayı ile haberleşme yoktur.** Eski `user-session-changed` / `building-session-changed` olayları kaldırıldı, store dinleyicilerini kendi tuttuğu için gerekmiyorlar. `sessionStorage`'a bu dosya dışında hiçbir yerden yazılmaz.
- **Kurulum durumu açılışta bir kez çözülür, hook değildir.** `main.jsx` mount'tan **önce** `await loadAccountState()` çağırır, sonuç `session.js`'te modül düzeyinde donar ve `needsSetup()` / `savedUsername()` ile senkron okunur. Gerekçesi kurulumun **tek yönlü kapı** olmasıdır: hesap satırı bir kez oluşunca `needsSetup` bir daha `true` olamaz, hesap silme yolu yoktur. Değişebildiği tek an `completeSetup` başarısıdır, onu da `markSetupComplete(username)` yazar. Bu yüzden abonelik makinesi (`useSyncExternalStore`, dinleyiciler) yoktur, oturumun aksine bu değer reaktif değildir.
  - **Eski `useNeedsSetup` hook'u kaldırıldı.** Aynı IPC'yi üç yer ayrı ayrı çağırıyordu (`StartupRedirect`, `Setup`, `Login`), yani soğuk açılışta 2-3 kez gidiyordu ve üçünün de kendi `isMounted` guard'ı, kendi `.catch` yedeği ve kendi `PageLoader` dalı vardı. Şimdi tek çağrı var ve karar senkron verildiği için **ilk boyama zaten doğru sayfadır**, arada "Yükleniyor..." karesi görünmez.
  - **IPC başarısız olursa varsayılan `needsSetup:false`'tur**, yani kullanıcı `/login`'e düşer. Kurulum gerçekten gerekliyse Setup sayfası zaten `completeSetup`'ın kendi kontrolüyle korunur, ama tersi (var olan hesabın üstüne kurulum ekranı açmak) daha kötü bir yanlıştır.
- **Seçili bina session'ı, bina durumu değişince güncellenir (kural).** `SelectBuilding`'de seçili binanın adı değişirse `setCurrentBuilding` yeniden yazılır, bina arşivlenir ya da kaldırılırsa `clearCurrentBuilding` çağrılır. Aksi hâlde `RequireBuilding` yalnızca session'a baktığı için kullanıcı arşivlenmiş bir binanın Dashboard'una dönüp oraya kayıt girebilir. Bina durumunu değiştiren yeni bir aksiyon eklenirse aynı kontrolü yaz.
- **`useTheme` modül düzeyinde tek kaynak tutar ve `session.js` ile aynı şekildedir.** Tema değeri ve `onToggleTheme` IPC aboneliği hook'un içinde değil modül gövdesindedir, hook `useSyncExternalStore` ile yalnızca abone olur. Aksi hâlde ikinci bir tüketici bağımsız bir tema state'i açar ve menüden gelen tek bir event temayı her abonede bir kez çevirir.
  - **`data-theme` attribute'unu yazan tam olarak iki yer vardır:** açılışta `themeInit.js`, değişimde `toggleTheme`. Yazma bilinçli olarak hook'ta **değildir**: `useLayoutEffect`'te olduğu dönemde her mount attribute'u zaten yazılı olan değere yeniden yazıyordu ve tema değişince `useTheme`'i kullanan her bileşen aynı attribute'u ayrı ayrı yazıyordu. Yeni bir tüketici eklerken DOM yazımını hook'a geri taşıma.
  - **Hook düz `theme` string'i döndürür, `{ theme, toggleTheme }` değil.** `toggleTheme` bir hook değil modül fonksiyonudur, çağıran onu ayrıca import eder.
- **Bina bağlamı.** Giriş sonrası kullanıcı `/select-building`'e yönlenir, bina seçer ya da oluşturur, `setCurrentBuilding` çağrılır ve `/dashboard`'a gidilir. **Tek aktif bina varsa bu ekran atlanır** ve doğrudan panoya geçilir. Hesap menüsündeki "Bina Değiştir" `location.state.manual` bayrağıyla gider, o zaman atlama yapılmaz. Bina gerektiren sayfalar `RequireBuilding` guard'ı altındadır. **Building-scoped `electronAPI` çağrıları `user.id` değil seçili `building.id`'yi geçer.** Yalnızca işlemi yapan kişiyi kaydeden alanlar (`collected_by`, iptal `userId`, `changePassword`) `useSession().id` kullanır. Dashboard başlığı ve Reports PDF başlığı `building.name`'dir.
- **Veri çekme deseni:** sayfa mount'ta `electronAPI` çağırır, `res.success` kontrol eder, hata mesajını SweetAlert ile gösterir. Cache katmanı yoktur, her sayfa girişinde taze veri alınır.
- **`electronAPI` çağrısında `?.` yalnızca `ErrorBoundary`'nin dışında kalan iki yerde kullanılır.** Bugün ikisi vardır: `useTheme.js`'in modül gövdesindeki `onToggleTheme` aboneliği (import anında, React daha yokken çalışır) ve `Footer`'ın `getAppVersion` çağrısı (`App.jsx` `<Footer />`'ı sınırın **dışında** render eder). Bu ikisinde `window.electronAPI` tanımsızken fırlatan hatanın yakalayıcısı yoktur ve sonuç mesajsız beyaz penceredir: birincisi `Footer → App → main.jsx` import zincirini kırar, ikincisi tüm React ağacını unmount eder. `?.` zincirin tamamını kısa devre yaptırdığı için (`.then().catch()` dahil) uygulama açılmaya devam eder, kullanıcı Login ekranındaki Türkçe hatayı görür.
  - **Sınırın içindeki çağrılarda düz `electronAPI.x()` yazılır.** Rota bileşenlerindeki hata zaten `ErrorBoundary`'nin kopyalanabilir ekranına düşer ve çoğu çağrı kendi `try/catch`'inde Türkçe mesaj gösterir. Oraya `?.` eklemek gerçek bir arızayı sessizce yutar.
  - `electronAPI` yalnızca iki durumda tanımsızdır: `npm run preview` (tarayıcıda çalışır, §15) ve paketli sürümde preload'un yüklenememesi.
- **Alert/Dialog:** SweetAlert **yalnızca `src/utils/alert.js`'te** kullanılır ve bu kural lint'te `no-restricted-imports` ile zorlanır (§3). Sayfalar `sweetalert2`'yi import etmez, `showAlert` metodlarını çağırır. Yeni bir dialog gerekiyorsa `alert.js`'e metod ekle.
  - **Dönüş sözleşmesi:** `confirm`/`confirmDanger` ham `SweetAlertResult` değil **`boolean`** döner (`if (confirmed)` yaz, `result.isConfirmed` değil). `prompt`/`cancelReason`/`passwordPrompt` değeri döner, vazgeçilirse `null`.
  - **Gövde (`body`) iki biçim alır:** düz string ya da `{ html }` / `{ text }` nesnesi. Gövde alan her metot (`toast` dahil) aynı `bodyOf` çözümlemesinden geçer, ayrı bir `text` parametresi taşıyan metot yoktur. Vurgu, satır sonu ya da tutar gösteren onaylar `{ html }` kullanır. HTML'e **kullanıcıdan gelen ham metin gömme**, gerekiyorsa `alert.js`'in `escapeHtml` yardımcısından geçir. Bugün tek örnek `temporaryPassword`'ün `managerName`'idir: değer 2-60 uzunluk dışında hiçbir karakter kısıtı taşımaz, dolayısıyla kaçırılmadan gömülemez.
  - **İmza:** `confirm(title, body, cancelText, confirmText)`. İptal metni 3., onay metni 4. parametredir (ekranda `reverseButtons` ile soldan sağa görünen sırayla aynı) ve ikisi de zorunludur.
  - **Trim:** `prompt` girdileri her zaman trim'lenir, tek istisna `type: "password"` alanlarıdır.
  - **Uzunluk sınırı `inputAttributes` ile verilir.** `prompt` bu alanı olduğu gibi SweetAlert'e geçirir ve handler sınırının UI karşılığı buradadır: `cancelReason` `maxlength: 300` taşır, çünkü iptal nedeni sınırı §9'da 300'dür. Sınırı yalnızca `validate` mesajıyla anlatma, kullanıcı sınırı yazarken görmelidir.
  - **Genişlik:** Diyalog metodları amaca özel genişlik taşır (`releaseNotes` 54em). Kod diyaloglarının üçü de `codeDialog` üzerinden tek bir genişliği (`CODE_DIALOG_WIDTH`) paylaşır. Paylaşılan bir metodu büyütmek yerine daha geniş bir diyalog için kendi metodunu ekle.
  - **Diyalog stillerinin tamamı `style.css`'tedir**, üretilen HTML'e inline `style` yazma. Renkler oradaki tema değişkenlerinden gelir, hex sabitleme. Sınıf adı `swal-*` olmak zorunda değildir: `renderReleaseNotesHtml`'in ürettiği `release-note-*` ailesi de oradadır, çünkü stilin sahibi diyalogu açan bileşen değil işaretlemeyi üreten modüldür. Bir bileşen CSS'inde yalnızca o bileşenin kendi DOM'u durur.
  - **Kod ve şifre gösteren diyalogların üçü de aynı davranıştadır.** `regeneratedCode`, `temporaryPassword` ve `transferredRecoveryCode` tek bir `codeDialog` üzerinden üretilir: dışarı tıklamayla kapanmaz, arka plan geçişi kapalıdır, onay metni "Anladım"dır ve panoya otomatik yazmaz, kullanıcı "Kodu Kopyala" butonuna basar. Üçü de bir daha gösterilmeyecek bir değer gösterdiği için bu ayarlar metoda özel değil `codeDialog`'a aittir.
  - **Başarı bildirimleri modal değil toast'tır** (`showAlert.toast`). Modal kalanlar: hatalar, karar isteyen diyaloglar ve bir kez gösterilen kod diyalogları.
- **Formatlama.** Tarih için `src/utils/date.js` tek sahiptir: `formatDate`, `formatMonthYear`, `getToday`/`getCurrentYear`/`getCurrentMonth` (hepsi TR bazlı). Renderer'da ham `new Date()` ile "bugün" hesaplama, ay adı dizisini sayfa içinde tekrar tanımlama. `MONTHS` dışa açılmaz, ay adına erişim `formatMonthYear` ve `getMonthOptions` üzerindendir. Formatlayıcılar boş ya da geçersiz girdide `"—"` döner, çağıran tarafta elle null kontrolü gerekmez. Bu sözleşme `formatMonthYear`'da **iki argümanı birden** kapsar: geçersiz ay kadar geçersiz yıl da `"—"` döndürür, `"Mart undefined"` gibi yarı biçimlenmiş metin üretilmez.
  **Kullanıcıya gösterilen tarih biçimi tektir: `5 Mart 2026`.** Kısa (`05.03.2026`) ve saatli (`... 14:30`) varyantlar bilinçli olarak kaldırıldı, çünkü aynı türden hücreler sayfadan sayfaya farklı görünüyordu. Girdiyi çözen yardımcının adı bu yüzden `parse` değil `toDate`'tir, saat bilgisi taşımaz ve yalnızca `Date` ya da `null` döner. Saat gösterilmesi gerekirse yeni bir biçim eklemeden önce sor, tek biçim kuralı bilinçlidir.
  **Tek `Intl.DateTimeFormat` örneği modül düzeyinde bir kez kurulur** ve gerekçesi `currency.js`'inkiyle aynıdır: `toLocaleDateString` seçenek nesnesiyle çağrıldığında her hücrede yeni bir biçimlendirici kurar, `formatDate` de Transactions, Reports ve Residents tablolarında satır başına çalışır. Seçenek nesnesini çağrı yerinde açma.
  **Dönem seçicilerinin kaynağı da bu dosyadır:** `getYearOptions()` (içinde bulunulan yıl dahil son 5 yıl), `getMonthOptions(year)` (içinde bulunulan yılda bu ayda biter) ve `clampMonth(year, month)`. Bunu kullanan üç sayfa var: `Apartments`, `Transactions`, `Reports`. Sonucu bir kuraldır: **gelecek bir dönem arayüzden seçilemez**, bu da §8 kural 2'nin kullanıcıya bakan yüzüdür. Asıl sınır burada değil `dues/handlers.js`'in `validatePeriod`'ündedir, buradaki seçiciler onun UI karşılığıdır. Yeni bir yıl/ay seçici yazarken listeleri elle üretme ve ay değişimini `clampMonth`'suz bırakma.
  **Ay sınırının tek sahibi dosya içi `monthLimit(year)`'dır**, `getMonthOptions` ile `clampMonth` onu paylaşır. `clampMonth` bu yüzden sırf uzunluk için on iki nesnelik seçenek dizisi üretmez. Sınır **gelecek yılı da kapsar**: geçmiş yıl 12 ay, içinde bulunulan yıl bu ay, gelecek yıl **sıfır** ay verir. `getYearOptions` gelecek yıl üretmediği için bu dal bugün ulaşılamaz, ama kural `=== currentYear` yerine sıralamayla kurulur ki seçici mantığı yıl listesinin içeriğine bağlı kalmasın. Seçenek listesi boşalınca `clampMonth` `1` döner, aksi hâlde `Math.min` geçersiz `0` üretirdi.
  **Para** için `src/utils/currency.js` → `formatCurrency(value)`. Tek biçim `1.250,00 ₺`'dir (tr-TR, her zaman iki hane kuruş), `null`/`undefined`/boş ya da sayıya çevrilemeyen girdide `"—"` döner. Sayfa içinde `toLocaleString("tr-TR")` ile elle para formatlama. **`Intl.NumberFormat` modül düzeyinde bir kez kurulur**, çünkü `toLocaleString` seçenek nesnesiyle çağrıldığında her hücrede yeni bir biçimlendirici kurar: 600 hücrede 16 ms ile 0,3 ms farkıdır ve Transactions ile Reports tabloları bu büyüklüktedir.
  **İşaret için ayrı export vardır: `formatSignedCurrency(value)`.** Pozitif değere `+` ekler, negatifin `-`'ini Intl zaten yazar, sıfır işaretsiz kalır. JSX'te elle `+`/`-` yazma. Yön bilgisi çağıranda tutarın işaretiyle ifade edilir, yani gider satırı `formatSignedCurrency(-amount)` çağırır. Bugün beş yerde kullanılır: Transactions'ın üç özet kartı ve işlem satırı, Reports'un gelir/gider satırı ve aynı satırın PDF karşılığı. `formatCurrency` `-0`'ı `0`'a çeker, aksi hâlde sıfır gider toplamı `-0,00 ₺` görünürdü.
- **PDF'e giden her metin `Reports.jsx`'in `toPdfText`'inden geçer.** jsPDF gömülü font olmadan standart `helvetica`'yı `WinAnsiEncoding` ile yazar ve o kod sayfasında `₺`, `ğ`, `Ğ`, `ş`, `Ş`, `ı`, `İ` yoktur. Bu karakterlerden **biri** geçtiğinde jsPDF o metin parçasının tamamını UTF-16BE olarak yazar, yani yalnızca o harf değil **hücrenin tümü** okunaksız çıkar. `toPdfText` Türkçe harfleri ASCII karşılığına, `₺`'yi `TL`'ye, tipografik tire ve tırnakları düz karşılıklarına çevirir, kalan desteklenmeyen karakteri `?` yapar. Diyakritiklerin tamamı katlanır (`ö` ve `ü` kod sayfasında olduğu hâlde), çünkü kelime içinde yarısı doğru yarısı yanlış bir yazım (`Açiklama`) tamamen ASCII bir yazımdan (`Aciklama`) daha bozuk görünür. Kural bu yüzden **kaynak metni değil çıktıyı** sadeleştirir: literaller düzgün Türkçe yazılır, katlama tek sınırda yapılır. Serbest metin alanları (bina adı, açıklama, sakin adı) bu sınırdan geçmezse tek bir emoji ya da yapıştırılmış akıllı tırnak koca bir hücreyi bozar. Gerçek çözüm Unicode bir TTF gömmektir, o da yeni bir varlık demektir ve önce sorulur.
- **Sabitler:** paylaşılan bir `utils/constants.js` **yoktur**. Her sabit onu kullanan modülde tanımlanır (`THEME_KEY` → `useTheme.js`). Birden fazla modülden kullanılan sabit, sahibi olan modülden export edilir. Sabitler için ayrı bir çöplük dosyası açma.
- **Tema:** light/dark, `style.css` içindeki CSS değişkenleri. Bileşen CSS'lerinde renkleri değişken üzerinden kullan, hex sabitleme.
  - **İlk temayı `public/themeInit.js` çözer, `useTheme` değil.** `<head>`'deki bu klasik script `localStorage` ve `prefers-color-scheme` sırasıyla bakıp `data-theme`'i **ilk boyamadan önce** yazar. `useTheme` başlangıç değerini `document.documentElement.dataset.theme`'den geri okur, kendi `localStorage` okuması yoktur. Aksi hâlde `:root` varsayılanı koyu olduğu için açık tema kullanan kullanıcı her açılışta koyu bir kare görürdü, çünkü React ağacı ilk boyamadan sonra mount olur. Script'in yeri `public/`'tir ve modül değildir, çünkü `src/` altındaki bir modül ertelenir ve o boyamadan sonra çalışır. `index.html`'e inline gömülemez, o da CSP'ye `script-src 'unsafe-inline'` eklemeyi gerektirirdi (§12).
  - **`theme` anahtarı iki dosyada geçer:** `public/themeInit.js` (okuma) ve `src/hooks/useTheme.js` (yazma). İki taraf ayrı modül sistemlerinde olduğu için ortaklaştırılamaz, biri değişirse diğeri de değişmelidir. Anahtar bu yüzden ikisinde de `THEME_KEY` adıyla tanımlıdır: paylaşılamayan bir değerin iki tarafta aynı adı taşıması, birini değiştirenin diğerini araması için tek ipucudur.
  - **Değişken eşiği:** yeni bir CSS değişkeni yalnızca gerçekten gerekliyse tanımlanır. Bir değer aynı dosyada birden fazla yerde kullanılıyorsa ya da temaya göre değişiyorsa değişken olur, tek yerde geçen ve temadan bağımsız bir değer için literal yaz.
  - **Temalar arası tek fark renktir.** İki tema aynı değişken setini aynı anahtarlarla tanımlar. Bunu garantilemek için geometri (offset, blur, spread, `1px solid`, katman sayısı) kuralın içinde literal yazılır ve değişken **yalnızca rengi taşır**: `box-shadow: 0 3px 16px var(--x-glow)` doğru, `box-shadow: var(--x-glow)` yanlıştır. Aynı sebeple `[data-theme="light"]` altında **yapısal** override yazma: orada yalnızca değişken değeri ezilir. Renk farkını da mümkün olduğunca değişkenle geçir (`--release-badge-bg` gibi), tema başına ayrı bir özellik bloğu son çare olsun. Eski sayfalarda doğrudan `background`/`color` ezen bloklar hâlâ vardır ve toplu düzeltilmemiştir, kural yeni yazılan koda uygulanır.
  - **Hareket kısıtlı mod tek yerden, `!important` ile kurulur.** `style.css`'in sonundaki `@media (prefers-reduced-motion: reduce)` bloğu `*` seçicisiyle `animation-duration`, `animation-iteration-count`, `transition-duration` ve `scroll-behavior` değerlerini **`!important` ile** ezer. Bunun iki sonucu vardır. **Birincisi:** bileşen CSS'inde yazılan `animation: none` çalışır (shorthand `animation-name`'i de sıfırlar, global kural ona dokunmaz) ve gecikmeli bir girişi susturmak için gereklidir, `.footer`'ın `0.4s` gecikmesi bu yüzden ayrıca `none`'lanır. **İkincisi:** bir animasyonu durdurmak yerine **yavaşlatmak** isteyen kural `!important` taşımak zorundadır, aksi hâlde sessizce kaybeder. Üç spinner (`.page-loader-spinner`, `.login-spinner`, `.recover` spinner'ı) tam olarak bunu yaşadı ve yavaşlama hiç uygulanmadı. Yükleme göstergesi hareket kısıtlı modda durdurulmaz, yavaşlatılır: duran bir spinner yüklemenin sürdüğünü artık anlatmaz.
  - Boşluk ve köşe yarıçapı için token ölçeği yoktur, literal px kullanılır. `style.css` global reset, tema değişkenleri, temel eleman stilleri ve SweetAlert sınıflarını barındırır, paylaşılan `.u-*` yardımcı sınıfı yoktur.
  - **Tek istisna sayfa kabuğudur.** Dokuz sayfa kapsayıcısı (`.dashboard-container`, `.apartments-container`, `.residents-container`, `.transactions-container`, `.reports-container`, `.profile-container`, `.income-container`, `.expense-container`, `.add-apartment-container`) ortak zemin, kenarlık, yarıçap ve gölgeyi `style.css`'teki tek bir kural listesinden alır. Sayfa CSS'i yalnızca yerleşimi (genişlik, dolgu, hizalama) tanımlar ve bu dört bildirimi **ezmez**, aksi hâlde sayfalar arasında görünür kabuk farkı oluşur. Yeni bir tam sayfa eklenirken sınıfı bu listeye yazılır.
  - **Bileşen renkleri değişken sözleşmesiyle geçirilir.** `PasswordStrength` `--pw-*`, `AuthField` `--af-*` ailesini kullanır ve her sayfa bu eşlemeyi **kendi kök sınıfında** yapar (`.login-page-bg`, `.setup-page-bg`, `.recover-page-bg`), `:root`'ta yapmaz. `--af-*` sözleşmesi yedi üyelidir (`bg`, `border`, `text`, `muted`, `accent`, `focus-ring`, `focus-glow`) ve bu sayı bilinçlidir: ikon, placeholder, dinlenen etiket ve `hint` tek bir `--af-muted`'ı, yüzen etiket ile odak kenarlığı ve toggle hover'ı tek bir `--af-accent`'i paylaşır. Üç tüketici de bunları zaten aynı değere bağlıyordu, ayrı isimler hak edilmemiş bir esneklikti. Rol gerçekten ayrışırsa o gün bölünür. Tüm sayfa CSS'leri tek bundle'da toplandığı için `:root` tanımları birbirini ezer. Dış boşluk bileşende değil sayfa CSS'inde kalır.
- **Koşullu mesajlara yer ayrılmaz.** Hata mesajı, doğrulama uyarısı ve ipucu satırı koşullu render edilir (`{error && <div .../>}`). Boşken yer tutan sabit yükseklikli yuva açılmaz. Mesaj belirince alttaki içeriğin kayması kabul edilen bedeldir. **İstisna:** Caps Lock göstergesi, alan içi rozet olarak konumlandığı için zaten akışta yer kaplamaz.
- **Şifre alanları.** Her şifre girişi Caps Lock rozeti taşır (alan içinde, göster/gizle butonunun solunda beliren "Büyük Harf" yazısı). Rozet ayrı bir bileşen **değildir**, `AuthField.jsx` içindeki dosya-yerel `CapsLockBadge` ile `useCapsLockOn()` hook'undan gelir. Sayfa kendi `capsLockOn` state'ini tutmaz ve input'a olay bağlamaz. İkisi de export edilmez ve `hooks/` altında durmaz, çünkü tek tüketicileri bu dosyadır. Aynı gerekçeyle `useDues` da `pages/Apartments/` içinde durur: `hooks/` klasörü birden fazla tüketicisi olan hook'lar içindir. **Rozet ayrı bir klasördeyken (`components/CapsLockIndicator/`) bunu Login de doğrudan kullanıyordu, Login `AuthField`'a taşınınca tek tüketici kaldı ve buraya alındı.** Ayrı durduğu son hâlde kendi CSS'i `AuthField`'ın `--af-toggle-width` değişkenini okuyordu, yani bağımsızlığın maliyetini ödeyip faydasını almıyordu. Hook `document` üzerinde dinler, alan `onBlur`'ünde sıfırlama yapılmaz. **`useTheme` gibi modül düzeyinde tek kaynak tutar:** değer ve üç dinleyici (`keydown`, `keyup`, `mousedown`) modül gövdesinde bir kez kurulur, hook yalnızca abone olur. Aksi hâlde aynı sayfadaki iki şifre alanı (şifre + tekrar) aynı donanım durumunu ayrı state'lerde ölçer ve `document`'a altı dinleyici bağlanır. Dinleyicilerin `getModifierState` taşıması zorunludur, olay listesine `focus` gibi modifier taşımayan bir olay eklenmez. Uyarı kutulu bir hata bloğu değildir, zeminsiz rozettir. Tam cümle `title` ve `aria-label`'dadır. Göster/gizle her alanda ayrı state ile çalışır.
- **Giriş ekranlarının form alanı** paylaşılan `AuthField` bileşenindedir (ikon + floating-label + isteğe bağlı şifre göster/gizle + Caps Lock rozeti + isteğe bağlı `hint`). Floating-label kurulumu: `<label>` input'un **kardeşi ve DOM'da ondan sonra** gelir, input `placeholder` taşımak zorundadır (`:not(:placeholder-shown)` çalışsın diye) ve dolgu üstten kalın alttan incedir.
  - **Adı `FormField` değildir ve bu bilinçlidir.** Bileşen genel bir form alanı değil, üç oturum ekranının (`Login`, `Setup`, `Recover`) alanıdır: `required` gövdesine gömülüdür, ikon zorunludur, dolgu şeması floating-label'a göre sabittir. Uygulamanın geri kalanındaki formlar (daire, sakin, gelir, gider) ham `<input>` kullanır ve bu bileşene taşınmaz. Yeni bir oturum ekranı eklenirse alanı buradan gelir, sıradan bir sayfa formu eklenirse gelmez.
  - **Şifre alanı ayrı bir bileşen değildir.** `type="password"` üç küçük dal sürer (input sınıfı, Caps Lock rozeti, göster/gizle butonu), geri kalan her şey metin alanıyla ortaktır. Ayrı bir `PasswordField` kabuğu ya kopyalar ya da iç/dış ikinci bir katman gerektirir, ikisi de bu ölçekte kazanç sağlamaz.
  - **`ref` doğrudan input'a bağlanır.** React 19'da `ref` sıradan bir prop olduğu için `forwardRef` yoktur. Tek kullanıcısı `Login`'dir, başarısız girişten sonra odağı şifre alanına geri verir. İlk odak ise ref ile değil `autoFocus` prop'uyla kurulur.
  - **Hata bağlantısı tek prop'tur: `errorId`.** Dolu geldiğinde input'a hem `aria-invalid` hem `aria-describedby` yazılır. İkisi ayrı prop değildir, çünkü çağıranın elinde tek bir koşul vardır (hata var mı yok mu). Üç ekran da hata bloğuna bir `id` verir ve alanlarına bunu geçirir, `role="alert"` tek başına yeterli değildir: o yalnızca hata belirdiği anda okutur, kullanıcı alana geri sekme yaptığında hatayı tekrar duyuramaz.
  - **Toggle butonunun genişliği `.af-wrapper`'daki `--af-toggle-width` değişkeninden gelir.** Üç kural birden ona bağlıdır: butonun kendi genişliği, `.af-input-with-toggle`'ın sağ dolgusu ve `.af-caps`'in sağ konumu (`calc(var(--af-toggle-width) + 12px)`). Genişliği değiştiren tek satır değişkendir, üç kural da kendiliğinden uyar.
- **Okunabilirlik (hedef kitle).** Kullanıcıların çoğunluğu 40+ yaş apartman yöneticileridir. **Alt sınır 1rem'dir:** gövde, etiket, giriş alanı, buton ve tablo hücresi metni bunun altına inmez. Uzun bir metni tek satıra sığdırmak için fontu küçültme, metni sar ya da kapsayıcıyı genişlet.
  - **Uygulama politikası:** Eski sayfalarda 1rem altı tanımlar hâlâ vardır ve bilinçli olarak toplu düzeltilmemiştir, çünkü yoğun tablo sayfalarında satır yüksekliği ve sütun genişliği değişir. Kural **yeni yazılan koda derhal uygulanır**, eski sayfalar o sayfaya dokunuldukça yükseltilir. Kalan ihlallerin sayısı burada tutulmaz, güncel durum için `grep -rE "font-size:\s*0\.[0-9]+rem" src` yeterlidir.
  - Rozet metinleri (Caps Lock rozeti, floated etiket, sürüm rozeti, `kbd` tuş kapağı) bu sınırdan ayrı değerlendirilir.
  - Kural `src/` dışındaki HTML pencerelerinde de geçerlidir (`guide.css`, `splash.css`).

### Rotalar

Koruma iki katmandır: oturum (`RequireGuest` / `RequireAuth`) ve seçili bina (`RequireBuilding`). **Üçü de layout route'tur:** `children` almazlar, `<Outlet />` render ederler ve `<Route element={<RequireAuth />}>` biçiminde bir rota grubunu sararlar. Yeni bir guard da aynı şekilde yazılır, rota başına sarmalayıcı tekrarlanmaz.

**Üçünün de yeri `App.jsx`'tir, `components/` altında dosyaları yoktur.** Hiçbiri DOM üretmez, yaptıkları tek iş `Outlet` ya da `Navigate` döndürmektir, yani görsel bir parça değil rota kararıdırlar. Oturum guard'ı da tek bileşen + `guestOnly` bayrağı değil **iki ayrı adlandırılmış guard**'tır: çağrı yerinde hangi korumanın uygulandığı bayrağın varlığından değil adından okunur.

| Rota               | Bileşen         | Koruma                                                                                        |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `/login`           | Login           | guest                                                                                         |
| `/setup`           | Setup           | guest, yalnızca `needsSetup` iken                                                             |
| `/recover`         | Recover         | guest, üç sayfa içi durum: kod → yeni şifre → sonuç                                           |
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

**Hesap menüsü (`AccountMenu`)** tüm korumalı sayfalarda, sağ üstte bulunur: Profilim, Bina Değiştir, ayraç, Çıkış Yap. Menünün prop'u yoktur, her sayfada aynı öğeleri gösterir. Öğeler dosya içi `MenuItem` bileşeninden üretilir, ayraç panelde açık bir eleman olarak durur. Yerleşim kuralı: sayfanın başlık satırı zaten `space-between` bir flex ise menü o satırın sağ ucuna girer, değilse başlığın üstüne paylaşılan `.account-menu-row` ile kendi satırında durur. Bu sınıf bileşenin CSS'inde değil `style.css`'tedir, çünkü sahibi menü değil onu yerleştiren altı sayfadır.

**Etiket `managerName`'dir**, yedek zincir yoktur. `manager_name` şemada NOT NULL'dur ve `completeSetup` onu 2-60 aralığında zorunlu tutar, `AccountMenu` de yalnızca `RequireAuth` altında render edilir. Dolayısıyla ne `session` null olabilir ne de alan boş kalabilir. Etiket `max-width` ile kırpıldığı için `title` olarak da verilir, uzun bir yönetici adı böylece okunabilir.

**Panelde ARIA menü rolü yoktur** (bilinçli). `role="menu"` + `role="menuitem"` ok tuşu gezinmesi ve roving `tabindex` vaat eder, ikisi de yazılmadı ve bu ölçekte gerekmiyor. Tetikleyici `aria-haspopup="true"` + `aria-expanded` taşır, öğeler sıradan `<button>`'dur ve doğal sekme sırasıyla gezilir. Rolleri geri eklerken klavye gezinmesini de yaz. Dışarı tıklama ve Escape menüyü kapatır, Escape ayrıca odağı tetikleyiciye geri verir.

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
- **Renderer:** hata mesajı SweetAlert ile gösterilir. Renderer'da ayrı bir log altyapısı yoktur, ama renderer konsoluna düşen `error` ve `warning` satırları main tarafından yakalanıp main.log'a yazılır (`catchRendererConsole`, `[Renderer] <mesaj> (<kaynak>:<satır>)` biçiminde). Yakalayıcı `app.on("web-contents-created")` ile kurulur, yani üç pencereyi de kapsar ve `src/` tarafında hiçbir kod gerektirmez. `info` ve `debug` bilinçli olarak alınmaz. Bu yol konsol metnini alır, yapısal stack trace vermez. React ağacındaki hatalar ayrıca `ErrorBoundary` ile yakalanır ve kullanıcıya sade bir hata ekranıyla gösterilir.
- **`ErrorBoundary` bilinçli olarak tek butonludur.** Ekran ne olduğunu söyler ve tek eylem sunar: `window.location.hash = "#/"` ardından `window.location.reload()`. Yeniden yükleme hem rotayı hem bozulmuş React ağacını tek adımda sıfırlar, bu yüzden ayrı bir "Yeniden Dene" butonu, `hashchange` dinleyicisi ve elle state sıfırlama yoktur. Oturum `sessionStorage`'da olduğu için yenilemeden etkilenmez. Ekranda stack trace ya da kopyalama butonu da yoktur: hata `console.error` ile zaten main.log'a düşer ve kullanıcıya dönük destek yolu menüdeki "Hata Bildir"dir. Hedef kitle için teknik detay eylem değildir (§1).
- Log mesajları İngilizce prefix + açıklama şeklindedir. Prefix modülü tanıtır: `[Main]`, `[Migrate]`, `[Database]`, `[Updater]`, `[Splash]`, `[MainWindow]`, `[Guide]`, `[Renderer]`, `[<domain>.handlers]`, `[<domain>.service]`. Renderer bileşenleri kendi adını prefix yapar (`[ErrorBoundary]`, `[Footer]`) ve bu satırlar main tarafından `[Renderer]` başlığıyla sarılarak main.log'a düşer.
- **Hata nesnesi olduğu gibi loglanır, `err.message` değil.** `console.error("[Main] Backup failed:", err)` doğru, `..., err.message)` yanlıştır. İkincisi stack'i atar ve log satırı hatanın nerede oluştuğunu söylemez. Gerçek bir arıza anında (yedekleme, geri yükleme, güncelleme) elimizdeki tek kanıt bu satırdır. Aynı sebeple `catch` bloğunu hata nesnesini yakalamadan yazma (`catch {`).
- **Sabite çıkarılan log metni yalnızca olguyu taşır, sonucu taşımaz.** Sonuç cümlesi (`"... atlanıp açılışa devam ediliyor"`) mesajın içine gömülürse, aynı sabiti farklı sonuçlu ikinci bir akış kullandığında log yalan söyler. `autoUpdater.js`'in `CHECK_TIMED_OUT_MESSAGE`'ı hem açılış hem menü akışında geçtiği için tam olarak bunu yaşadı. Sabit zaman aşımının süresini söyler, ne olduğunu ise olayın gerçekleştiği yer yazar (`skipUpdate` açılışta, menü akışında `[Updater] On-demand update check failed:` prefix'i). Zaman aşımı süresi metne elle yazılmaz, `${SABIT / 1000}s` ile türetilir.

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
                       #   Aynı komut postinstall olarak da tanımlıdır, npm install sonrası
                       #   kendiliğinden çalışır. rebuild elle tetikleme yoludur
npm run lint           # ESLint
npm run format:check   # Prettier sapma listesi. Yalnızca raporlar, dosyaya yazmaz
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

### Installer İçeriği (`package.json` → `build`)

İki kural, ikisi de aynı sebeple vardır: aynı dosya hem Vite bundle'ında hem `node_modules`/`assets` kopyasında olursa installer'a iki kez girer.

- **`dependencies` yalnızca main process'in `require` ettiği paketleri taşır**, bugün beşi vardır: `bcryptjs`, `better-sqlite3`, `electron-log`, `electron-serve`, `electron-updater`. Renderer'ın kullandığı her paket (React, react-router-dom, jspdf, jspdf-autotable, sweetalert2, react-icons) **devDependencies**'tedir, çünkü Vite onları `dist/`'e bundle eder. electron-builder `dependencies`'teki her paketi `files` listesinden bağımsız olarak uygulamaya kopyalar (`app-builder-lib/out/util/appFileCopier.js` → `computeNodeModuleFileSets`), yani renderer paketi `dependencies`'e yazılırsa onlarca MB ölü ağırlık installer'a girer. Yeni bir paket eklerken soru şudur: bunu `electron/` mi `src/` mi require ediyor.
- **`assets/` içinden yalnızca main process'in kullandıkları paketlenir.** `build.files` bu yüzden `assets/**/*`'ı alıp `backgrounds/login` ve `backgrounds/setup` dizinlerini `!` ile dışlar, o ikisi `src/` CSS'lerinden referanslıdır ve Vite kopyalarını zaten `dist/assets`'e koyar. Yeni bir arka plan eklerken hangi sürecin kullandığına göre karar ver. **Bilinen tek istisna `app-logo.webp`'dir:** splash.html ham dosyayı, Login ve Setup ise Vite kopyasını kullandığı için installer'a iki kez girer ve bu kaçınılmazdır. Dışlama listesine ekleme, splash logosuz kalır.
- `npm run dist` `--publish never` ile çağrılır. Yayınlama release adımında elle yapılır, ortamda bir `GH_TOKEN` varken yerel build'in yayına kalkışması istenmez.

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
- `electron/` ve `database/` dışında yorum yazmak, izinli klasörde kodun ne yaptığını tekrar etmek ya da yorumu Türkçe yazmak (§3)
- `showAlert.confirm` sonucunda `result.isConfirmed` beklemek (metod boolean döner, §11)
- `buildingId` filtresi olmadan bina verisi sorgulamak
- Handler içinde elle try/catch yazmak (`createHandle` zarfını kullan, §5.2)
- Modül gövdesinde `const db = getDb()` yazmak (bağlantı henüz açılmamıştır, §7.4)
- Metin alanını service'te tekrar trim'lemek (normalizasyon handler'da tek yerdedir, §9), şifreyi trim'lemek
- Service'te `err.message`'ı renderer'a döndürmek ya da iş kuralı ihlalini `transaction` içinden `throw` etmek
- `catch` bloğunu hata nesnesini yakalamadan yazmak (`catch {`), log satırı arıza anındaki tek kanıttır (§13)

# Mavikent Site Yönetimi Uygulaması — Teknik Referans Dokümanı

> Bu dosya projenin **ana bilgi kaynağıdır**. Kod üzerinde çalışan her model/geliştirici önce bu dosyayı okumalıdır.
> Gelecek hedefler, roadmap ve teknik borç analizi için bkz. `ROADMAP.md`.
> **Yaşayan doküman kuralı:** Mimari, şema, IPC veya iş kuralı değişikliği yapan her değişiklik bu dosyayı da güncellemelidir.

## 0. Okunmayacak Dosya ve Klasörler

```
node_modules/
dist/
dist_electron/
database.db
database.db-wal
database.db-shm
package-lock.json
.cache/
```

---

## 1. Proje Genel Bakış

**Tür:** Electron + React masaüstü uygulaması (yalnızca Windows hedeflenir, NSIS installer)
**Amaç:** Apartman yöneticilerinin aidat, gelir/gider, daire/sakin ve raporlama işlemlerini tek uygulamadan, **tamamen offline** yönetmesi. Sunucu yoktur; tüm veri lokal SQLite dosyasındadır.

**Teknik Stack:**

| Katman | Teknoloji |
| ------ | --------- |
| Masaüstü kabuk | Electron v41 (CommonJS) |
| UI | React v19 + react-router-dom v7 (HashRouter), Vite v8 |
| Veritabanı | SQLite via `better-sqlite3` (senkron, main process'te) |
| Şifreleme | `bcryptjs` (şifre + kurtarma kodu hash'leri) |
| Bildirim/Dialog (renderer) | SweetAlert2 (`src/utils/alert.js` sarmalayıcısı) |
| PDF | `jspdf` + `jspdf-autotable` (renderer tarafında üretilir, main'de kaydedilir) |
| Güncelleme | `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`) |
| Loglama | `electron-log` (main process) |
| Prod statik sunum | `electron-serve` (`dist/` klasörünü app:// üzerinden yükler) |
| Test | Vitest (`npm run test`) |

**Güncel Sürüm:** `package.json` → `version` alanı tek doğruluk kaynağıdır (bu dokümana sürüm yazma).

---

## 2. Mimari Genel Bakış

### 2.1 Process Modeli

```
┌─────────────────────────  Main Process (Node.js)  ─────────────────────────┐
│ electron/main.js  →  app lifecycle, splash, update, migration, seed        │
│ electron/modules/*/handlers.js  →  IPC giriş noktası + validasyon          │
│ electron/modules/*/service.js   →  iş mantığı + SQL (better-sqlite3)       │
│ database/db.js  →  tek DB bağlantısı (WAL)                                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ ipcMain.handle / ipcRenderer.invoke
┌──────────────────────────────┴──────────────────────────────────────────────┐
│ electron/preload.js  →  contextBridge, kanal whitelist (`electronAPI`)      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Renderer (React)  →  src/pages/* yalnızca `window.electronAPI.*` çağırır    │
│ Node erişimi YOK (nodeIntegration:false, contextIsolation:true)             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Neden bu model:** better-sqlite3 senkron ve native olduğu için yalnızca main process'te çalışır. Renderer hiçbir zaman doğrudan DB'ye, dosya sistemine veya Node API'lerine erişmez — tüm erişim preload üzerinden whitelisted IPC ile yapılır.

### 2.2 Açılış (Startup) Sırası — `electron/main.js`

Sıra **kritiktir**, değiştirme:

1. `electron-log` init + error catching, `app.disableHardwareAcceleration()`
2. Tek instance kilidi (`requestSingleInstanceLock`) — ikinci açılış mevcut pencereyi öne getirir
3. `app.whenReady` → DB bağlantısı (`database/db.js` require edilir; hata → dialog + quit)
4. Splash penceresi açılır, `waitForSplashReady()` beklenir
5. **Yalnızca paketli sürümde:** `checkForUpdatesBeforeStartup()` — güncelleme kontrolü **migration'lardan ÖNCE** çalışır (v1.1.9 kararı: bozuk migration çıkan bir sürüm, güncelleme ile kurtarılabilsin diye)
6. `runMigrations(db)` → migrations + schema yükleme
7. `registerIpcHandlers(ipcMain)` → tüm handler'lar kaydedilir
8. `seedAdminAccount(db)` → admin satırı yoksa oluşturulur
9. Ana pencere oluşturulur, `ready-to-show`'da splash kapanır

### 2.3 Pencereler — `electron/windows/`

| Klasör | İçerik |
| ------ | ------ |
| `main/index.js` | Ana BrowserWindow. Dev'de `http://localhost:5173`, prod'da `electron-serve` ile `dist/`. `webPreferences`: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:false` (preload'un `require` yapabilmesi için), `webSecurity:true` |
| `splash/` | Açılış ekranı; kendi minimal `preload.js`'i vardır (`splash:*` kanalları). Sürüm, güncelleme durumu ve indirme yüzdesini gösterir |
| `guide/` | Kullanım kılavuzu penceresi (saf HTML+CSS+JS, React değil) — menüden açılır |

---

## 3. Kod Yazma Kuralları

- **Dil:** UI metinleri ve kullanıcıya dönen hata mesajları **Türkçe**; kod ve yorumlar **İngilizce** (commit başlıkları Türkçe gelenektedir, git log'a bak)
- **Stil:** Prettier
- **Naming:** değişkenler `camelCase`, React bileşenleri `PascalCase`, sabitler `UPPER_SNAKE_CASE`, IPC kanal string'leri `domain:kebab-case`
- **Modül sistemi:** `electron/` ve `database/` → CommonJS (`require`); `src/` → ESM (`import`). Karıştırma.
- **Import sırası** (CommonJS dosyalarda): 1) Node builtin, 2) external paketler, 3) local (`./`, `../`). Her grup kendi içinde alfabetik.
- **PropTypes:** Renderer bileşenlerinde prop doğrulaması `prop-types` ile yapılır (TypeScript yok)

### Yapmadan Önce Kullanıcıya Sor

- Mimari değişiklikler (klasör yapısı, yeni dependency)
- 3+ dosya etkileyen refactor
- Veritabanı şeması değişikliği
- IPC endpoint ekleme/değiştirme
- 100+ satır silme

### Asla Kullanıcı Onayı Olmadan Yapma

- `git commit` / `git push`
- `gh release create` / `gh release edit`
- `npm run dist` veya `npm run build`

### Asla Yapma

- `.env` oluşturma veya API anahtarı/şifre ekleme
- Kullanıcıya sormadan bağımlılık yükseltme
- Renderer'a Node API açma (preload whitelist dışına çıkma)
- `dues` / `due_payments` / `incomes` / `expenses` kayıtlarını fiziksel silme (bkz. §8 iş kuralları)

---

## 4. Klasör Yapısı

```
SiteManager/
├── assets/              # icon.ico ve statik varlıklar (installer + pencere ikonu)
├── database/
│   ├── schema/          # Tablo şemaları — NN_tablo.sql, alfabetik yüklenir, CREATE ... IF NOT EXISTS
│   ├── migrations/      # Mevcut tablolara ALTER — NNN_aciklama.sql, bir kez çalışır
│   ├── db.js            # Tek bağlantı (WAL, pragma'lar, closeDb) — path: dev'de proje kökü, prod'da userData
│   ├── migrate.js       # runMigrations(db) — önce migrations, sonra schema
│   └── seed.js          # Admin satırı (SETUP_PENDING) + kurtarma kodu üretim/normalizasyon yardımcıları
│
├── electron/
│   ├── ipc/
│   │   ├── channels.js        # Tüm IPC kanal sabitleri (Object.freeze + duplicate kontrolü).
│   │   │                      #   Handler'lar VE preload buradan import eder — string'i asla elle yazma
│   │   ├── safeHandler.js     # createSafeHandler(domain) → her handler'ı tek tip try/catch + loglama
│   │   │                      #   zarfına sarar; event'i yutar, hata detayını renderer'a sızdırmaz
│   │   └── index.js           # registerIpcHandlers — modules/*/handlers.js'i alfabetik sırayla kaydeder
│   ├── modules/               # Domain bazlı gruplama: her domain handler (validasyon) + service (SQL) çifti
│   │   ├── apartment/{handlers,service}.js
│   │   ├── auth/{handlers,service}.js
│   │   ├── dashboard/{handlers,service}.js
│   │   ├── dues/{handlers,service}.js
│   │   ├── financial/{handlers,service}.js
│   │   ├── report/{handlers,service}.js
│   │   ├── resident/{handlers,service}.js  # Sakin yaşam döngüsü (ekle/düzenle/çıkış/geçmiş)
│   │   ├── system/handlers.js         # Servisi yok — sadece app version döner
│   │   └── backup/service.js          # Handler'ı yok — IPC dışı, menu.js doğrudan çağırır
│   ├── launch/
│   │   └── autoUpdater.js      # Açılışta splash'e bağlı güncelleme akışı (timeout'lu)
│   ├── windows/
│   │   ├── main/index.js       # Ana pencere oluşturma + electron-serve
│   │   ├── splash/             # Açılış ekranı (kendi preload'u ile)
│   │   └── guide/              # Kullanım kılavuzu penceresi
│   ├── main.js                 # App lifecycle — bkz. §2.2 açılış sırası
│   ├── menu.js                 # Uygulama menüsü (Dosya: yedekle/geri yükle, Görünüm: tema, Yardım, DevTools)
│   └── preload.js              # contextBridge — safeInvoke/safeOn ile kanal whitelist
│
└── src/
    ├── components/      # Footer vb. paylaşılan bileşenler
    ├── router/          # ProtectedRoute (rol bazlı rota koruması)
    ├── hooks/           # useTheme, useCurrentUser (sessionStorage + 'user-session-changed' eventi)
    ├── pages/           # Her sayfa kendi klasöründe (JSX + CSS), App.jsx'te lazy-load
    ├── utils/           # alert.js (SweetAlert2 sarmalayıcı), constants.js, format.js (₺/tarih format)
    ├── App.jsx          # Rotalar (HashRouter) + StartupRedirect (setup/login yönlendirmesi)
    ├── main.jsx         # React mount
    └── style.css        # Global stiller — light/dark tema CSS değişkenleri
```

**Dosya boyutu uyarısı:** `src/pages/Apartments/Apartments.jsx` (~700+ satır) projenin en büyük dosyasıdır; büyütmeden önce alt bileşenlere bölmeyi düşün (bkz. ROADMAP teknik borç).

---

## 5. IPC Mimarisi

### 5.1 Akış (örnek: `recordPayment`)

```
Renderer: window.electronAPI.recordPayment({...})
  → preload.js safeInvoke(CH.DUES.RECORD_PAYMENT, payload)   # kanal whitelist + tip guard
  → ipcMain.handle (electron/modules/dues/handlers.js)        # safeHandler zarfı: event yutulur
  →   safeHandler içindeki fn(payload)                        # alan varlığı, aralık, enum, regex
  → dues/service.js                                           # transaction içinde SQL
  → dönüş: { success: true, ...data } | { success: false, message: "Türkçe mesaj" }
```

### 5.2 Kurallar

1. **Kanal string'leri yalnızca `electron/ipc/channels.js`'te tanımlanır.** Handler ve preload aynı sabiti import eder; `channels.js` duplicate değerde açılışta hata fırlatır.
2. **Yeni endpoint eklerken 4 dosya değişir:** `channels.js` (sabit) → `modules/<domain>/handlers.js` (validasyon) → `modules/<domain>/service.js` (SQL) → `preload.js` (electronAPI metodu). Yeni domain ise `ipc/index.js`'e kayıt ekle. Bu dokümandaki §10 tablosunu da güncelle.
3. **Handler deseni — `safeHandler`:** Her handler `createSafeHandler("<domain>")` ile üretilen `safeHandler(channel, fn, errorMessage?)` zarfına sarılır (bkz. `electron/ipc/safeHandler.js`). Modül başında bir kez `const safeHandler = createSafeHandler("<domain>")` tanımlanır; her `ipcMain.handle(CH.X, safeHandler(CH.X, (payload) => {...}))` şeklinde yazılır. Zarf: Electron'un `event` argümanını yutar (handler yalnızca payload alır), `fn`'in sonucunu (senkron/async) olduğu gibi döndürür, beklenmeyen throw/reject'i yakalayıp `console.error("[<domain>.handlers] <channel>:", err)` loglar ve jenerik `errorMessage` (varsayılan `"İşlem sırasında bir hata oluştu."`) döner. **Handler içinde elle try/catch yazma** — özel bir hata mesajı gerekiyorsa 3. parametreyle geç (ör. report `SAVE_FILE` → `"Dosya kaydedilemedi."`). İstisna: `event` nesnesine ihtiyaç duyan veya `{success}` sözleşmesi dışında ham değer döndüren handler (ör. `system` → düz version string'i) sarılmaz.
4. **Dönüş sözleşmesi:** Her handler `{ success: boolean, ... }` döner (yukarıdaki `system` istisnası hariç). Hata durumunda `message` alanı kullanıcıya gösterilebilir Türkçe metindir; iç hata detayı renderer'a sızdırılmaz. İş kuralı ihlali `{ success:false, message }` **döndürerek** bildirilir (throw değil) — throw yalnızca beklenmeyen hatalar içindir ve `safeHandler`'ın `catch`'ine düşer.
5. **main→renderer eventleri** (`EVENTS.*`, `splash:*`) `webContents.send` ile gönderilir; preload `safeOn` unsubscribe fonksiyonu döner — React `useEffect` cleanup'ında çağrılmalıdır.
6. **Yetkilendirme:** IPC katmanında oturum doğrulaması yoktur (tek kullanıcılı masaüstü uygulaması). Veri izolasyonu `managerId` parametresiyle sağlanır — manager'a ait sorgular her zaman `WHERE manager_id = ?` içermelidir. Bilinen açık: `getPaymentHistory` yalnızca `dueId` alır (ROADMAP'te düzeltme görevi var).

---

## 6. Kullanıcı Rolleri, Kimlik Doğrulama ve Oturum

| Rol       | Yetki                                  |
| --------- | -------------------------------------- |
| `admin`   | Tüm işlemler + manager hesabı yönetimi |
| `manager` | Aidat, gelir/gider, daire, raporlar    |

- Şifreler `bcryptjs` ile hash'lenir; düz metin hiçbir yerde saklanmaz/loglanmaz
- **Oturum:** `sessionStorage` → `currentUser` anahtarı (`SESSION_USER_KEY` sabiti). `useCurrentUser` hook'u okur; oturum değişikliği `user-session-changed` window eventi ile yayılır. Oturum kapatma tamamen client-side: `sessionStorage.clear()` + event dispatch (IPC yok)
- **"Beni hatırla":** 30 günlük session token
- **Rota koruması:** `src/router/ProtectedRoute.jsx` rol bazlı; yanlış rol → kendi dashboard'una redirect
- Admin hesabı yalnızca bir adet olabilir; `seed.js` `is_active`'e bakmaksızın `role='admin'` varlığını kontrol eder

### İlk Kurulum (Setup) Akışı

1. `seed.js` admin satırını `password_hash='SETUP_PENDING'`, `recovery_hash=NULL`, `password_changed_at=NULL` ile oluşturur
2. Renderer açılışta `getSetupState()` çağırır → `needsSetup:true` ise `/setup`'a yönlendirir (`App.jsx` → `StartupRedirect`)
3. Kullanıcı şifresini belirler → `completeAdminSetup(password)` → kurtarma kodu üretilir ve **yalnızca bir kez** modalda gösterilir
4. Endpoint yalnızca `password_changed_at IS NULL` iken çalışır (oturumsuzdur; kurulum bitince kilitlenir)
5. Mevcut kurulumlar `008_mark_existing_admin_setup.sql` ile korunur (zorla setup'a düşmez)

### Admin Şifre Kurtarma

- Kurtarma kodu: 16 karakter, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` alfabesi (I/O/0/1 yok — okuma hatasını önlemek için), `XXXX-XXXX-XXXX-XXXX` gösterimi. `normalizeRecoveryCode` girişteki tire/boşluk/küçük harfi tolere eder
- `resetAdminPassword(recoveryCode, newPassword)` giriş ekranından, oturumsuz çalışır; kod **tek kullanımlıktır**, her kullanımda yenisi üretilir
- Giriş yapmış admin `regenerateRecoveryCode(password)` ile (mevcut şifre doğrulanarak) yeni kod üretebilir
- `recovery_hash` bcrypt ile saklanır; manager'larda `NULL`

### Manager Hesapları

- `createManager` kullanıcı adı: `/^[A-Za-z0-9_]{3,}$/`; e-posta ASCII regex ile doğrulanır; şifre ≥ 8 karakter
- `admin` kullanıcı adı ve `DEFAULT_ADMIN_EMAIL` seed hesabı için rezervedir (sabitler `seed.js`'ten import edilir — elle yazma)
- Login'de timing attack koruması: kullanıcı bulunamasa da sahte hash karşılaştırması yapılır

---

## 7. Veritabanı

### 7.1 Bağlantı ve Pragma'lar (`database/db.js`)

- **Tek bağlantı**, main process'te, modül yüklenirken açılır. Dev'de dosya proje kökünde (`database.db`), paketli sürümde `%APPDATA%/mavikent-site-yonetimi/` (userData) altındadır
- Pragma'lar: `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=3000`, `cache_size=-16000` (16 MB), `temp_store=MEMORY`
- `closeDb()`: `optimize` + `wal_checkpoint(TRUNCATE)` + `close`. `before-quit`'te otomatik çağrılır; restore işlemi dosya kilidini bırakmak için elle çağırır
- better-sqlite3 **senkron** çalışır — sorgular event loop'u bloklar. Uzun sorgu yazma; listeler büyürse sayfalama ekle (ROADMAP)

### 7.2 Şema

```sql
users                 (id, username, email, password_hash, recovery_hash, role, is_active,
                       last_login, password_changed_at, created_at, updated_at)
                       -- recovery_hash: admin kurtarma kodunun bcrypt hash'i (tek kullanımlık); manager'da NULL
                       -- password_changed_at NULL = setup tamamlanmamış

apartments            (id, apartment_no UNIQUE NOCASE per manager_id, floor,
                       type∈{0+1,1+1,2+1,3+1,4+1}, square_meters,
                       due_amount, is_active, manager_id→users.id, created_at, updated_at)

residents             (id, full_name, phone, email, national_id,
                       resident_type∈{owner,tenant}, move_in_date, move_out_date,
                       is_active, notes, apartment_id→apartments.id ON DELETE CASCADE,
                       created_at, updated_at)
                       -- Trigger: move_out_date <= date('now') ise is_active=0 (gelecek çıkış tarihi aktif kalır)

dues                  (id, apartment_id→apartments.id, year, month,
                       due_amount CHECK(>0 AND <=50000),
                       paid_amount CHECK(>=0 AND <=due_amount),
                       status∈{unpaid,partial,paid}, created_at, updated_at)
                       UNIQUE(apartment_id, year, month)

due_payments          (id, due_id→dues.id, collected_by→users.id,
                       amount CHECK(>0 AND <=1000000),
                       payment_method∈{cash,bank_transfer,card,other},
                       payment_date, note CHECK(len<=500), created_at)

payment_cancellations (id, payment_id→due_payments.id UNIQUE,
                       cancelled_by→users.id, cancelled_at, cancel_reason)
                       -- Immutable audit log: trigger ile UPDATE/DELETE engellenir

incomes               (id, amount, date, description, category∈{dues,other},
                       is_cancelled, cancelled_at, cancel_reason,
                       manager_id→users.id, due_payment_id→due_payments.id UNIQUE,
                       cancelled_by→users.id, created_at, updated_at)

expenses              (id, amount, date, description,
                       category∈{maintenance,cleaning,utility,staff,other},
                       is_cancelled, cancelled_at, cancel_reason,
                       manager_id→users.id, cancelled_by→users.id, created_at, updated_at)
```

### 7.3 Migration / Schema Sistemi (`database/migrate.js`)

`runMigrations()` her başlangıçta çalışır, sırası:

1. **`database/migrations/`** — uygulanmamış dosyalar ada göre sıralı, her biri kendi transaction'ında çalışır ve `migrations` tablosuna kaydedilir. Detaylar:
   - Migration sırasında `foreign_keys=OFF`; sonunda `foreign_key_check` yapılır, ihlal varsa rollback
   - `duplicate column name` hatası "zaten uygulanmış" sayılır ve kaydedilir (idempotent kurtarma)
   - **Fresh install:** `users` tablosu yoksa tüm migration'lar çalıştırılmadan "uygulandı" işaretlenir — tabloları schema aşaması güncel haliyle oluşturur
2. **`database/schema/`** — `CREATE TABLE/TRIGGER IF NOT EXISTS` ile yüklenir; mevcut kurulumda no-op

| Durum | Ne yapılır |
| ----- | ---------- |
| Yeni tablo | `database/schema/NN_tablo.sql` oluştur (ör. `09_yeni_tablo.sql`) |
| Mevcut tabloya sütun/index/trigger | `database/migrations/NNN_aciklama.sql` **VE** ilgili `schema/` dosyasını da aynı hale getir (fresh install ile mevcut kurulum aynı şemada buluşmalı — v1.1.8'deki kolon kayması bug'ının dersi) |
| CHECK constraint değişikliği | SQLite `ALTER ... CHECK` desteklemez → tablo yeniden oluşturma migration'ı (örnek: `001_due_payments_raise_amount_limit.sql`) |
| Tablo silme/yeniden adlandırma | Önce kullanıcıya sor |

**Migration yazım kuralları:** dosya salt SQL'dir (JS migration yok); geri alma (down) mekanizması yoktur — geri dönüş yeni bir migration ile yapılır; migration bir kez release edildiyse **asla düzenlenmez**, yeni dosya eklenir.

### 7.4 SQL Yazım Standartları

- Her sorgu **prepared statement** (`db.prepare(...).run/get/all`) — string birleştirme ile SQL üretme; dinamik filtre gerekiyorsa WHERE parçalarını koşullu kur, değerleri her zaman parametre olarak geçir
- Birden fazla yazma içeren işlemler `db.transaction(() => {...})()` içinde
- Manager verisi sorgularında `manager_id = ?` filtresi zorunlu (bkz. §5.2 madde 5)
- Para `REAL` saklanır (bilinçli karar: TL tutarları, tek kullanıcılı defter — kuruş hassasiyeti toplamalarda `ROUND` ile yönetilir); ekranda `src/utils/format.js` ile `₺` formatlanır
- Tarihler ISO-8601 `TEXT` (`YYYY-MM-DD` veya `datetime('now')`)

---

## 8. Kritik İş Kuralları

1. **Aidat kaydı silinemez** — yalnızca düzenlenebilir.
2. **`getDuesForMonth`** — o ay için eksik aidat kayıtları `INSERT OR IGNORE` ile otomatik oluşturulur (aktif daireler için, o anki `apartments.due_amount` ile).
3. **`bulkUpdateDueAmount`** — yalnızca `apartments.due_amount`'ı günceller; mevcut `dues` kayıtlarına dokunmaz. Yeni tutar sonraki ay oluşturulduğunda etkili olur.
4. **Gelir/gider silinemez** — `cancelIncome`/`cancelExpense` ile `is_cancelled=1` yapılır; iptal nedeni ve iptal eden kaydedilir.
5. **Ödeme iptali** — `due_payments` kaydı silinmez; `payment_cancellations`'a immutable kayıt eklenir. Bağlı `incomes` kaydı otomatik iptal edilir. `paid_amount` çıkarma ile değil, **aktif ödemelerin `SUM`'ı ile yeniden hesaplanır** (idempotent, tutarlı).
6. **Aidat bağlantılı gelir** (`due_payment_id IS NOT NULL`) doğrudan iptal edilemez; yalnızca `cancelPayment` üzerinden otomatik iptal edilir.
7. **Soft-delete:** daire `is_active=0` — `recordPayment` `AND is_active=1` kontrolü içerir. Pasif daireye ödeme alınamaz.
8. **Sakinler (ayrı `resident` domain + `/residents` sayfası):** `is_active=1` aktif sakindir; bir dairenin birden fazla geçmiş sakini olabilir. `move_out_date` **bugün veya geçmiş** bir tarihe set edilince trigger `is_active=0` yapar; **gelecek** bir çıkış tarihi sakini aktif bırakır (henüz taşınmadığı için verileri görünmeye devam eder). Not: gelecek tarih geldiğinde otomatik deaktivasyon olmaz (trigger yalnızca yazma anında çalışır); tarih geçtikten sonraki ilk güncellemede deaktif olur. **Sakin yaşam döngüsü artık daire formuna gömülü değildir** (`updateApartment` sakine dokunmaz; `isResidentReplacement` sezgisi kaldırıldı). Kullanıcı niyeti açık aksiyonlarla ifade edilir:
   - `addResident` — dairede **aktif sakin yoksa** yeni sakin ekler; aktif sakin varken reddeder (önce çıkış gerekir).
   - `updateResident` — aktif sakin satırını yerinde günceller. Düzenleme modalı mevcut değerlerle **prefill** edilir; overwrite eder (boş bırakılan alan = bilinçli temizleme, kazara veri kaybı olmaz). Manager sahipliği `residents JOIN apartments` ile doğrulanır.
   - `moveOutResident` — `move_out_date` set eder; trigger deaktif eder. **Değişim** = önce çıkış, sonra yeni sakin ekleme (iki açık adım; eski sakin geçmiş kaydı olarak korunur).
   - `getResidentsOverview` — manager'ın aktif daireleri + aktif sakini (LEFT JOIN). `getResidentHistory` — bir dairenin tüm (aktif+geçmiş) sakinleri.
9. **Ödeme kaydı → gelir kaydı:** `recordPayment` aynı transaction'da `incomes`'a `category='dues'`, `due_payment_id` bağlı bir kayıt ekler. Aidat geliri asla elle girilmez.
10. **Yedekleme/geri yükleme** (`electron/modules/backup/service.js`, menüden çağrılır, IPC değil):
    - Yedek: `db.backup(filePath)` (WAL-güvenli online backup) + hedefteki artık `-wal/-shm` temizliği
    - Geri yükleme: seçilen dosyada `integrity_check` → onay → mevcut DB `.bak`'a kopyalanır → `closeDb()` (Windows dosya kilidi için) → kopyala → eski `-wal/-shm` silinir (yeni DB'ye replay olmasın) → `app.relaunch()`. Hata olursa `.bak`'tan geri dönülür.

---

## 9. Validasyon Katmanları

Her IPC çağrısı üç katmanda doğrulanır — **değişiklik yaparken üç katmanı da güncelle**:

| Katman | Dosya | Ne kontrol eder |
| ------ | ----- | --------------- |
| 1. Bridge | `preload.js` | Kanal whitelist, temel tip/null guard |
| 2. Handler | `electron/modules/*/handlers.js` | Alan varlığı, tip, aralık, format (regex, enum), rezerve değerler — `safeHandler(fn)` içindeki `fn`'de yapılır |
| 3. DB | `database/schema/*.sql` | CHECK, NOT NULL, UNIQUE, FK, trigger |

Handler katmanı asıl güvenlik sınırıdır (preload atlatılabilir varsayılır). DB katmanı son savunma hattıdır — CHECK ihlali service'teki `resolveDbError` ile Türkçe mesaja çevrilir; ortak `safeHandler` yalnızca beklenmeyen (throw edilen) hataları jenerik mesaja çevirir (bkz. §5.2 madde 3).

**Handler ↔ şema paritesi (kural):** Handler validasyonu, ilgili sütunun `CHECK` kısıtındaki aralık/format/enum'u **birebir yansıtmalıdır**. Amaç: sınır dışı girdi jenerik DB hatası yerine handler'da düzgün Türkçe mesajla yakalansın. Şemadaki bir CHECK'i değiştirirken handler'daki eş kontrolü de güncelle. Mevcut parite noktaları:
- `apartment` → daire no (1-10, harf/rakam), kat (-2..99), metrekare (0<x≤1000), aidat (0<x≤50000). **Sakin alanları apartment'ta değil `resident` handler'ında doğrulanır.**
- `resident` → telefon (≥10, `[0-9+()- ]`), e-posta (ASCII, `@` + `.`, ≥5), TC (11 hane), sakin türü (`owner,tenant`), giriş/çıkış tarihi (geçerli ISO tarih + `çıkış ≥ giriş`), çıkış (move-out) tarihi (geçerli ISO)
- `auth` → e-posta uzunluğu ≤254, kullanıcı adı `[A-Za-z0-9_]{3,}`, şifre ≥8
- `dues` → ödeme tutarı (0<x≤1.000.000), not ≤500, iptal nedeni ≤300, ödeme tarihi (ISO + `≥2000-01-01`)
- `financial` → tutar (0<x≤1.000.000), açıklama ≤500, tarih (ISO + `≥2000-01-01`), iptal nedeni ≤300, kategori enum (gelir: `dues,other`; gider: `maintenance,cleaning,utility,staff,other`)

**Girdi normalizasyonu (validasyondan önce):** Kullanıcı metin alanları handler katmanında, **validasyondan önce** in-place `trim()` edilir; böylece hem validasyon (anchored regex boşluğa takılmaz) hem de DB'ye yazılan değer kırpılmış olur. Kural: **normalize tek yerde, handler'da yapılır — service tekrar trim'lemez.**
- `apartment/handlers.js` → `normalizeApartmentData` (`TRIMMED_FIELDS` listesi: yalnızca `apartment_no`), `ADD` ve `UPDATE` yollarında çağrılır.
- `resident/handlers.js` → `normalizeResidentData` (tüm sakin string alanları: `full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes`), `ADD` ve `UPDATE` yollarında çağrılır.
- `auth/handlers.js` → `normalizeIdentityFields` (`username`, `email`), `LOGIN` ve `CREATE_MANAGER` yollarında çağrılır.
- **Şifreler asla trim'lenmez** (baştaki/sondaki boşluk kasıtlı olabilir).
- `financial` `description`/`category` ile `dues`/`financial` `reason` alanları da handler/service sınırında kırpılır (financial `insertRecord` içinde, cancel/reason ise handler'da `.trim()` ile).

---

## 10. electronAPI — IPC Endpoint Özeti

| Grup | Metodlar |
| ---- | -------- |
| Apartment | `addApartment`, `updateApartment`, `deleteApartment`, `bulkUpdateDueAmount` |
| Auth | `login`, `getManagers`, `createManager`, `updateManagerStatus`, `changePassword`, `resetAdminPassword`, `regenerateRecoveryCode`, `getSetupState`, `completeAdminSetup` |
| Dashboard | `getStats` |
| Dues | `getDuesForMonth`, `recordPayment`, `cancelPayment`, `getPaymentHistory` |
| Financial | `addIncome`, `addExpense`, `getTransactions`, `cancelIncome`, `cancelExpense` |
| Reports | `getReportData`, `saveReportFile` |
| Resident | `getResidentsOverview`, `getResidentHistory`, `addResident`, `updateResident`, `moveOutResident` |
| System | `getAppVersion` |
| Events (main→renderer) | `onToggleTheme` |

Kanal adları için tek kaynak: `electron/ipc/channels.js`.

---

## 11. React / Renderer Mimarisi

- **Routing:** HashRouter (Electron `file://`/`app://` uyumu için — BrowserRouter kullanma). Rotalar `App.jsx`'te, tüm sayfalar `lazy()` + `Suspense`
- **State yönetimi:** Global state kütüphanesi **yoktur** (bilinçli karar — uygulama küçük). Sayfa state'i lokal `useState`/`useEffect`; oturum `sessionStorage` + `useCurrentUser`; tema `useTheme` (CSS değişkenleri + `onToggleTheme` IPC eventi)
- **Veri çekme deseni:** sayfa mount'ta `electronAPI` çağırır, `res.success` kontrol eder, hata mesajını SweetAlert ile gösterir. Cache katmanı yok — her sayfa girişinde taze veri
- **Alert/Dialog:** doğrudan `Swal.fire` çağırma; `src/utils/alert.js` sarmalayıcısını kullan (tema uyumu orada)
- **Formatlama:** para/tarih için `src/utils/format.js`; magic string'ler `src/utils/constants.js`
- **Tema:** light/dark, `style.css` içindeki CSS değişkenleri; bileşen CSS'lerinde renkleri değişken üzerinden kullan, hex sabitleme

### Rotalar

| Rota | Bileşen | Rol |
| ---- | ------- | --- |
| `/login` | Login | — |
| `/setup` | Setup | — (yalnızca `needsSetup` iken) |
| `/admin` | AdminDashboard | admin |
| `/dashboard` | Dashboard | manager |
| `/add-apartment` | AddApartment | manager |
| `/apartments` | Apartments | manager |
| `/residents` | Residents | manager |
| `/add-income` | AddIncome | manager |
| `/add-expense` | AddExpense | manager |
| `/transactions` | Transactions | manager |
| `/profile` | Profile | manager |
| `/reports` | Reports | manager |

---

## 12. Güvenlik Kuralları

- `nodeIntegration:false`, `contextIsolation:true`, `webSecurity:true` — değiştirme. `sandbox:false` yalnızca preload'un CommonJS `require` ihtiyacı içindir
- Preload'da **whitelist dışı kanal çağrısı fırlatır** (`safeInvoke`/`safeOn`) — yeni kanal eklemeden preload'dan çağrılamaz
- Handler hataları renderer'a jenerik mesajla döner; stack/iç detay **asla** UI'a sızdırılmaz
- Şifre/kurtarma kodu asla loglanmaz, asla renderer'a düz metin dönülmez (kurtarma kodu tek istisna: üretildiği anda bir kez gösterilir)
- Harici URL açma yalnızca `shell.openExternal` ile ve sabit URL'lerle yapılır
- Uygulama offline'dır; tek ağ trafiği `electron-updater`'ın GitHub Releases kontrolüdür

---

## 13. Hata Yönetimi ve Loglama

- **Main process:** `electron-log` (`log.initialize()` + `errorHandler.startCatching()`, dosya limiti 5 MB). Log dosyası: `%APPDATA%/mavikent-site-yonetimi/logs/main.log`. Kritik açılış hataları ayrıca `dialog.showErrorBox` ile gösterilir
- **Handler'lar:** `console.error("[<domain>.handlers] <channel>:", err)` deseni (electron-log console'u yakalar). Bu log ortak `safeHandler` zarfı tarafından otomatik üretilir; `<channel>` tam kanal string'idir (ör. `apartment:add`). Handler içinde elle try/catch yazılmaz (bkz. §5.2 madde 3)
- **Servisler:** beklenen iş kuralı ihlallerinde `{ success:false, message }` döner; beklenmeyen hatalarda throw eder (handler yakalar)
- **Renderer:** hata mesajı SweetAlert ile gösterilir; renderer'da ayrı log altyapısı yoktur
- Log mesajları İngilizce prefix (`[Migrate]`, `[Database]`, `[Main]`, `[Seed]`) + açıklama şeklindedir

---

## 14. Performans Kuralları

- better-sqlite3 senkrondur → IPC handler'ları hızlı tutulmalı; ağır rapor sorgularında index kullan (`year, month`, `manager_id` filtreleri)
- Listeleri renderer'da filtrelemek yerine SQL'de filtrele (özellikle Transactions büyüdükçe)
- Sayfalar lazy-load'dur — yeni sayfa eklerken aynı deseni koru
- `app.disableHardwareAcceleration()` bilinçlidir (eski donanımlarda render sorunlarını önler) — kaldırma
- Büyük PDF üretimi renderer'da yapılır; UI donmasını önlemek için üretim öncesi loading göstergesi kullan

---

## 15. Build, Dağıtım ve Release Süreci

```bash
npm run dev            # Vite + Electron eş zamanlı (concurrently + wait-on)
npm run start          # Sadece Electron (önceden build edilmiş dist/ ile)
npm run build          # Vite production build
npm run dist           # Vite build + electron-builder (.exe NSIS installer → dist_electron/)
npm run rebuild        # Native modülleri (better-sqlite3) Electron ABI'sine yeniden derle
npm run lint / test    # ESLint / Vitest
npm run reset-db       # Dev DB dosyalarını siler → fresh install + /setup akışı
npm run reset-appdata  # Paketli sürümün %APPDATA% verisini siler
```

### Release Adımları (kullanıcı onayıyla)

1. `package.json` → `version` yükselt (semver: bugfix=patch, özellik=minor)
2. Commit mesajı geleneği: `feat: vX.Y.Z — kısa Türkçe açıklama` / `fix: vX.Y.Z — ...`
3. `npm run dist` → `dist_electron/Mavikent-Site-Yonetimi-Setup-X.Y.Z.exe`
4. GitHub Release oluştur (tag `vX.Y.Z`); `electron-updater` `latest.yml` + installer'ı release asset'lerinden okur
5. Otomatik güncelleme: açılışta kontrol (20 sn timeout, indirme için 60 sn stall watchdog — internet yoksa/yavaşsa uygulama açılmaya devam eder). Kullanıcı "Şimdi Yeniden Başlat" derse `quitAndInstall`

### Build Ortam Notları (Windows)

- NSIS build'i `TMP=C:\WINDOWS\TEMP` gibi anormal temp değişkenlerinde bozulur — build öncesi TMP/TEMP'in kullanıcı temp'ine işaret ettiğini doğrula
- `setAppUserModelId` çağrısı görev çubuğu ikonunun boş çıkmasına neden olmuştu — ekleme
- `asarUnpack: **/*.node` — better-sqlite3 native binary'si asar dışında kalmalı

---

## 16. Debugging Notları

| Sorun | Bakılacak yer |
| ----- | ------------- |
| Uygulama açılmıyor (prod) | `%APPDATA%/mavikent-site-yonetimi/logs/main.log` |
| "Blocked IPC channel" hatası | Kanal `channels.js`'te tanımlı mı? Preload güncellenmiş mi? |
| Migration hatası | `main.log` + `migrations` tablosu içeriği; migration transaction'ı rollback olur |
| DB kilitli (Windows) | WAL dosyaları + başka instance kontrolü; `busy_timeout=3000` var |
| Dev'de sıfırdan başlama | `npm run reset-db` (3 dosyayı birden siler — tek tek silme) |
| DevTools | Menü → DevTools (dev modda) |
| Güncelleme test | Yalnızca paketli sürümde çalışır (`isDev` kontrolü); dev'de update akışı atlanır |

---

## 17. Mimari Karar Kayıtları (ADR Özeti)

| # | Karar | Gerekçe |
| - | ----- | ------- |
| 1 | better-sqlite3 (senkron) main process'te | Offline, tek kullanıcı, transaction garantisi basit; async ORM karmaşıklığı gereksiz |
| 2 | Handler/service ayrımı, domain bazlı modüller | Validasyon ile SQL'i ayırmak; her domain tek klasörde (v1.1.7 refactor) |
| 3 | Kanal sabitleri tek dosyada + preload whitelist | Kanal adı typo'su açılışta yakalanır; renderer keyfi kanal çağıramaz |
| 4 | Soft-delete + immutable audit (`payment_cancellations`) | Finansal kayıtlar izlenebilir olmalı; silme yerine iptal |
| 5 | `paid_amount` = aktif ödemelerin SUM'ı | Artımlı güncelleme drift yaratır; yeniden hesap idempotenttir |
| 6 | Update kontrolü migration'lardan önce | Bozuk migration içeren sürüm güncellemeyle kurtarılabilsin (v1.1.9) |
| 7 | Global state kütüphanesi yok | Sayfa başına lokal state yeterli; bağımlılık maliyeti fayda getirmiyor |
| 8 | Para `REAL` | TL defteri, tek kullanıcı; kuruş hassasiyeti ROUND ile yönetilir. Hassas muhasebe gerekirse kuruş-integer'a migration düşünülür |
| 9 | HashRouter | Paketli Electron'da `file://`/custom protocol altında BrowserRouter path'leri kırılır |
| 10 | Setup akışı: `SETUP_PENDING` sentinel + zorunlu ilk kurulum ekranı | Varsayılan şifre riski sıfırlanır; kurtarma kodu bir kez gösterilir (v1.2.0) |
| 11 | Ortak `safeHandler` zarfı (`ipc/safeHandler.js`) | Her handler'daki tekrar eden try/catch + loglama + `event` yutma boilerplate'i tek yerde toplanır; handler'lar yalnızca validasyon + service çağrısına odaklanır |
| 12 | Sakin yönetimi ayrı `resident` domain + `/residents` sayfası; merge-form sezgisi yerine açık aksiyonlar | `updateApartment`'a gömülü üç yönlü sakin dallanması (`isResidentReplacement`) sorumlulukları karıştırıyor ve kısmi güncellemede veri kaybı riski taşıyordu. Ekle/Düzenle/Çıkış/Geçmiş açık aksiyonları kullanıcı niyetini tahmin etmeye gerek bırakmaz; daire formları yalnızca daire tutar |

Yeni önemli karar aldığında bu tabloya bir satır ekle: **karar + gerekçe**, tahmin bırakma.

---

## 18. Küçük Modeller İçin Hızlı Rehber

Yeni bir görevde izlenecek sıra:

1. **Görev bir sayfa/UI işi mi?** → `src/pages/<Sayfa>/` içinde çalış; veri ihtiyacı varsa mevcut `electronAPI` metodlarına bak (§10)
2. **Yeni veri/endpoint mi gerekiyor?** → Önce kullanıcıya sor (§3). Onaylanırsa §5.2'deki 4-dosya adımını izle ve üç validasyon katmanını da yaz (§9)
3. **Şema değişikliği mi?** → §7.3 tablosuna göre migration + schema çiftini birlikte güncelle; iş kurallarını (§8) ihlal etmediğini kontrol et
4. **Emin olmadığın davranış mı var?** → Tahmin etme; ilgili `service.js`'i oku — iş mantığının tek doğruluk kaynağı koddur, bu doküman haritadır
5. **Bitirirken:** değişen davranışı bu dokümanda güncelle; tamamlanan ROADMAP maddesini ROADMAP.md'den sil

Sık yapılan hatalar (yapma):

- Kanal string'ini elle yazmak (sabit import et)
- Yalnızca schema'yı veya yalnızca migration'ı güncellemek (ikisi birlikte)
- `dues`/`incomes`/`expenses` kaydını DELETE etmek (iptal mekanizması kullan)
- Renderer'dan `require`/Node API kullanmaya çalışmak
- SweetAlert'i doğrudan çağırmak (`utils/alert.js` kullan)
- `manager_id` filtresi olmadan manager verisi sorgulamak
- Handler içinde elle try/catch yazmak (`safeHandler` zarfı kullan — §5.2 madde 3)
- Metin alanını service'te tekrar trim'lemek — normalizasyon handler'da tek yerde yapılır (§9); şifreyi trim'lemek

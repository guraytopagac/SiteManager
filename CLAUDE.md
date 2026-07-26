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

| Katman                     | Teknoloji                                                                     |
| -------------------------- | ----------------------------------------------------------------------------- |
| Masaüstü kabuk             | Electron v41 (CommonJS)                                                       |
| UI                         | React v19 + react-router-dom v7 (HashRouter), Vite v8                         |
| Veritabanı                 | SQLite via `better-sqlite3` (senkron, main process'te)                        |
| Şifreleme                  | `bcryptjs` (şifre + kurtarma kodu hash'leri)                                  |
| Bildirim/Dialog (renderer) | SweetAlert2 (`src/utils/alert.js` sarmalayıcısı)                              |
| PDF                        | `jspdf` + `jspdf-autotable` (renderer tarafında üretilir, main'de kaydedilir) |
| Güncelleme                 | `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`)             |
| Loglama                    | `electron-log` (main process)                                                 |
| Prod statik sunum          | `electron-serve` (`dist/` klasörünü app:// üzerinden yükler)                  |
| Test                       | Vitest (`npm run test`)                                                       |

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
8. `seedAccount(db)` → hesap satırı yoksa oluşturulur; oluşturma başarısız olursa hata dialog'u gösterilip `app.quit()` ile çıkılır (hesapsız uygulamanın açılmasına izin verilmez)
9. Ana pencere oluşturulur, `ready-to-show`'da splash kapanır

### 2.3 Pencereler — `electron/windows/`

| Klasör          | İçerik                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main/index.js` | Ana BrowserWindow. Dev'de `http://localhost:5173`, prod'da `electron-serve` ile `dist/`. `webPreferences`: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:false` (preload'un `require` yapabilmesi için), `webSecurity:true` |
| `splash/`       | Açılış ekranı; kendi minimal `preload.js`'i vardır (`splash:*` kanalları). Sürüm, güncelleme durumu ve indirme yüzdesini gösterir                                                                                                        |
| `guide/`        | Kullanım kılavuzu penceresi (saf HTML+CSS+JS, React değil) — menüden açılır                                                                                                                                                              |

---

## 3. Kod Yazma Kuralları

- **Dil:** UI metinleri ve kullanıcıya dönen hata mesajları **Türkçe**; kod ve yorumlar **İngilizce** (commit başlıkları Türkçe gelenektedir, git log'a bak)
- **Stil:** Prettier
- **Naming:** değişkenler `camelCase`, React bileşenleri `PascalCase`, sabitler `UPPER_SNAKE_CASE`, IPC kanal string'leri `domain:kebab-case`
- **Modül sistemi:** `electron/` ve `database/` → CommonJS (`require`); `src/` → ESM (`import`). Karıştırma.
- **Import sırası** (CommonJS dosyalarda): 1) Node builtin, 2) external paketler, 3) local (`./`, `../`). Her grup kendi içinde alfabetik.
- **Prop doğrulaması yoktur** (TypeScript de yok). `prop-types` bağımlılığı ve tüm `Component.propTypes` blokları kaldırıldı (2026-07-20): React 19 `propTypes` denetimini paketten çıkardı, tanımlar sessizce yok sayılıyordu — yanlış tip için hiçbir uyarı üretilmiyordu. Yeni bileşene `propTypes` **ekleme**; prop sözleşmesini destructuring imzasından ve varsayılan değerlerden okunur tut
- **Yorum yazma:** Koda açıklama yorumu (`//`, `/* */`) **eklenmez** — kod kendini anlatmalıdır. Bir kararın gerekçesi korunacaksa yorum yerine bu dokümana yaz: mimari/iş kuralı ilgili bölüme, kalıcı bir tercih §17 ADR tablosuna, teknik borç `ROADMAP.md`'ye. Mevcut yorumları toplu temizleme amacıyla silme; yalnızca yenisini ekleme.

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
│   └── seed.js          # Hesap satırı (SETUP_PENDING) + kurtarma kodu üretim/normalizasyon yardımcıları
│
├── electron/
│   ├── ipc/
│   │   ├── channels.js        # Tüm IPC kanal sabitleri (Object.freeze + duplicate kontrolü).
│   │   │                      #   Handler'lar VE preload buradan import eder — string'i asla elle yazma
│   │   └── index.js           # registerIpcHandlers — modules/*/handlers.js'i alfabetik sırayla kaydeder
│   ├── modules/               # Domain bazlı gruplama: her domain handler (validasyon) + service (SQL) çifti
│   │   ├── apartment/{handlers,service}.js
│   │   ├── auth/{handlers,service}.js       # Giriş hesapları (kişi/login); createManager bina adı istemez
│   │   ├── building/{handlers,service}.js   # Bina (defter) CRUD: list/create/rename/archive — owner_id ile sahiplik
│   │   ├── dashboard/{handlers,service}.js
│   │   ├── dues/{handlers,service}.js
│   │   ├── financial/{handlers,service}.js
│   │   ├── report/{handlers,service}.js
│   │   ├── resident/{handlers,service}.js  # Sakin yaşam döngüsü (ekle/düzenle/çıkış/geçmiş)
│   │   ├── system/handlers.js         # Servisi yok — sadece app version döner
│   │   ├── backup/service.js          # Handler'ı yok — IPC dışı, menu.js doğrudan çağırır
│   │   └── shared/                    # Domain'ler arası paylaşılan yardımcılar (handler/service değil)
│   │       ├── safeHandler.js         # createSafeHandler(domain) → her handler'ı tek tip try/catch + loglama
│   │       │                          #   zarfına sarar; event'i yutar, hata detayını renderer'a sızdırmaz
│   │       └── dbError.js             # createDbErrorResolver(columnLabels) → CHECK/UNIQUE/NOT NULL/FK
│   │                                  #   SQLite hatalarını Türkçe mesaja çevirir (resolveDbError, §9)
│   ├── autoUpdater.js          # Açılışta splash'e bağlı güncelleme akışı (timeout'lu)
│   ├── windows/
│   │   ├── main/index.js       # Ana pencere oluşturma + electron-serve
│   │   ├── splash/             # Açılış ekranı (kendi preload'u ile)
│   │   └── guide/              # Kullanım kılavuzu penceresi
│   ├── main.js                 # App lifecycle — bkz. §2.2 açılış sırası
│   ├── menu.js                 # Uygulama menüsü (Dosya: yedekle/geri yükle, Görünüm: tema, Yardım, DevTools)
│   └── preload.js              # contextBridge — safeInvoke/safeOn ile kanal whitelist
│
└── src/
    ├── components/      # Footer (sürüm + sürüm notları modalı), ErrorBoundary, PageLoader, ProtectedRoute (auth/guest rota koruması — rol yok, ADR #26),
    │                    #   CapsLockIndicator (şifre alanı içi Caps Lock uyarısı) vb. paylaşılan bileşenler
    ├── hooks/           # useTheme, useCurrentUser (oturum kaynağı: get/set/clearCurrentUser + 'user-session-changed' eventi),
    │                    #   useCurrentBuilding (seçili bina: get/set/clearCurrentBuilding + 'building-session-changed'; logout'ta da temizlenir),
    │                    #   useCapsLockOn (Caps Lock durumu — boolean döner)
    ├── pages/           # Her sayfa kendi klasöründe (JSX + CSS), App.jsx'te lazy-load
    ├── utils/           # alert.js (SweetAlert2 sarmalayıcı), date.js (tarih/saat format), passwordStrength.js (şifre skoru + kural/ölçer üretimi — Setup ve Recover paylaşır), releaseNotes.js (yama notları + HTML üretimi + "görüldü" durumu — Footer modalında gösterilir)
    ├── App.jsx          # Rotalar (HashRouter) + StartupRedirect (setup/login yönlendirmesi)
    ├── main.jsx         # React mount
    └── style.css        # Global stiller — light/dark tema CSS değişkenleri
```

**Apartments sayfa bölünmesi:** `src/pages/Apartments/` artık tek dosya değildir — `Apartments.jsx` salt-okunur aidat/daire listesini, `ApartmentsManage.jsx` daire işlemlerini (düzenle/sil/ödeme/toplu aidat modalları) barındırır; ortak parçalar `components/`, sabitler `constants.js`, aidat veri çekme mantığı `useDues.js` hook'unda toplanmıştır (bkz. §11 Rotalar).

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
3. **Handler deseni — `safeHandler`:** Her handler `createSafeHandler("<domain>")` ile üretilen `safeHandler(channel, fn, errorMessage?)` zarfına sarılır (bkz. `electron/modules/shared/safeHandler.js`). Modül başında bir kez `const safeHandler = createSafeHandler("<domain>")` tanımlanır; her `ipcMain.handle(CH.X, safeHandler(CH.X, (payload) => {...}))` şeklinde yazılır. Zarf: Electron'un `event` argümanını yutar (handler yalnızca payload alır), `fn`'in sonucunu (senkron/async) olduğu gibi döndürür, beklenmeyen throw/reject'i yakalayıp `console.error("[<domain>.handlers] <channel>:", err)` loglar ve jenerik `errorMessage` (varsayılan `"İşlem sırasında bir hata oluştu."`) döner. **Handler içinde elle try/catch yazma** — özel bir hata mesajı gerekiyorsa 3. parametreyle geç (ör. report `SAVE_FILE` → `"Dosya kaydedilemedi."`). İstisna: `event` nesnesine ihtiyaç duyan veya `{success}` sözleşmesi dışında ham değer döndüren handler (ör. `system` → düz version string'i) sarılmaz.
4. **Dönüş sözleşmesi:** Her handler `{ success: boolean, ... }` döner (yukarıdaki `system` istisnası hariç). Hata durumunda `message` alanı kullanıcıya gösterilebilir Türkçe metindir; iç hata detayı renderer'a sızdırılmaz. İş kuralı ihlali `{ success:false, message }` **döndürerek** bildirilir (throw değil) — throw yalnızca beklenmeyen hatalar içindir ve `safeHandler`'ın `catch`'ine düşer. Renderer bir hata türüne göre **dallanıyorsa** (yalnızca göstermiyorsa), servis ayrıca makine-okunur bir `code` alanı döner ve renderer o alana bakar — `message` metnine `startsWith`/`includes` ile bakma, metin değişince dallanma sessizce bozulur. Mevcut kod: `resetAccountPassword` → `INVALID_RECOVERY_CODE` (Recover sayfası bu durumda adım 1'e döner).
5. **main→renderer eventleri** (`EVENTS.*`, `splash:*`) `webContents.send` ile gönderilir; preload `safeOn` unsubscribe fonksiyonu döner — React `useEffect` cleanup'ında çağrılmalıdır.
6. **Yetkilendirme:** IPC katmanında oturum doğrulaması yoktur (tek kullanıcılı masaüstü uygulaması). Veri izolasyonu **`buildingId`** parametresiyle sağlanır (ADR #25 öncesi `managerId`'ydi) — bina verisi sorguları her zaman `WHERE building_id = ?` (veya `JOIN apartments a ... a.building_id = ?`) içermelidir. İptal işlemlerinde **iki ayrı kimlik** geçer: sahiplik `buildingId`, işlemi yapan kişi `userId` (`cancelled_by`). `getPaymentHistory` `{ dueId, buildingId }` alır ve `dues JOIN apartments` üzerinden bina sahipliğini doğrular. Bina CRUD'unda (`building` domaini) izolasyon `owner_id` ile: `WHERE owner_id = ?`.

---

## 6. Kullanıcı Rolleri, Kimlik Doğrulama ve Oturum

**Tek hesap modeli (ADR #26):** Uygulama **tek role** sahiptir — bir makinede **bir hesap** vardır. Bu hesap hem binaları yönetir, hem kendi kurtarma kodunu tutar, hem de gerektiğinde **devredilir**. Admin/manager ayrımı ve ikinci hesap açma mantığı **kaldırıldı** (ADR #26 ile #25/#22 sonlandırıldı). Kullanıcıya dönük etiket: **"Site Yöneticisi"** (kişi). Hesabın kişi adı `manager_name`'de tutulur, kurulumda girilir ve `useCurrentUser().managerName` ile karşılamada/Profile'da gösterilir.

- **Rol kavramı tamamen kaldırıldı (018).** `users.role` kolonu (ve kullanılmayan `display_name`) migration 018 ile tablodan **silindi**; artık ne şemada, ne kodda, ne session'da rol vardır. Tek hesap olduğundan `getSetupState`/`regenerateRecoveryCode`/`completeSetup` (ve seed'in varlık kontrolü) satırı `ORDER BY id LIMIT 1` ile bulur. `useCurrentUser` session'ında `role` alanı ve `VALID_ROLES` doğrulaması kaldırıldı. (Eski `WHERE role='admin'` sentinel'i "rol sistemi var" izlenimi veriyordu; oysa rol yok.)
- Şifreler `bcryptjs` ile hash'lenir; düz metin hiçbir yerde saklanmaz/loglanmaz.
- **Oturum:** `sessionStorage` → `currentUser` anahtarı (`SESSION_USER_KEY`, `useCurrentUser.js`). Tek doğruluk kaynağı `src/hooks/useCurrentUser.js`:
  - `useCurrentUser()` reaktif okuma; `getCurrentUser()` hook dışı okuma.
  - `setCurrentUser(user)` login sonrası yazar (persist edilen alanlar: `id, role, username, email, managerName, last_login`) + `user-session-changed` yayınlar.
  - `clearCurrentUser()` logout: `sessionStorage.clear()` + event.
  - **Kural:** `sessionStorage.setItem/clear` + elle `dispatchEvent` yazma; helper'ları kullan.
- **Kalıcı oturum ("Beni hatırla") YOKTUR.** Oturum yalnızca `sessionStorage`'dadır; uygulama kapanınca silinir. (Bkz. `ROADMAP.md`.)
- **Rota koruması:** `ProtectedRoute` yalnızca **auth/guest** ayrımı yapar (rol yok): `guestOnly` girişliyi `/select-building`'e atar, korumalı rota girişsizi `/`'e atar. Manager sayfaları ayrıca `RequireBuilding` altındadır (§11).
- Tek hesap; `seed.js` hesap satırının varlığını kontrol eder (yoksa `SETUP_PENDING` ile oluşturur).

### İlk Kurulum (Setup) Akışı

1. `seed.js` hesabı `username='admin'` (yer tutucu), `password_hash='SETUP_PENDING'`, `recovery_hash=NULL`, `password_changed_at=NULL` ile oluşturur.
2. Renderer açılışta `getSetupState()` çağırır → `needsSetup:true` ise `/setup`'a yönlendirir.
3. Kullanıcı **ad soyad + kullanıcı adı + şifre** belirler → `completeSetup({ username, password, managerName })` → seed satırının `username`/`manager_name` alanları yazılır (kullanıcı adı `/^[A-Za-z0-9_]{3,}$/`), kurtarma kodu üretilip **bir kez** gösterilir. Kullanıcı adı artık **kurulumda seçilir** (eski sabit `admin` kısıtı kaldırıldı); tek hesap olduğundan çakışma olmaz.
4. Endpoint yalnızca `password_changed_at IS NULL` iken çalışır (oturumsuz; kurulum bitince kilitlenir). Sayfa mount'ta `getSetupState` sorar, kurulum tamamlanmışsa `/login`'e yönlenir.
5. Mevcut kurulumlar `008_mark_existing_admin_setup.sql` ile korunur.

### Hesap Şifre Kurtarma

- Kurtarma kodu: 16 karakter, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` alfabesi (I/O/0/1 yok), `XXXX-XXXX-XXXX-XXXX`. `normalizeRecoveryCode` tire/boşluk/küçük harfi tolere eder.
- `resetAccountPassword(recoveryCode, newPassword)` **`/recover` sayfasından** (giriş ekranındaki "Şifremi unuttum?"), oturumsuz; kod **tek kullanımlıktır**, her kullanımda yenisi üretilir. Sayfa iki adımlı (1: kod, 2: yeni şifre + tekrar); kod adım 1'de sunucuya sorulmaz (sadece format), gerçek doğrulama tek `resetAccountPassword` çağrısında. Kod hatalıysa adım 1'e dönülür, girilen şifre state'te korunur.
- **Kullanıcı adı kurtarma:** Kullanıcı adı için ayrı bir kurtarma endpoint'i **yoktur** (brute-force oracle'ından kaçınmak için, ADR #16 mantığı). `resetAccountPassword` başarı yanıtında hesabın `username`'ini de döndürür; `/recover` başarı diyaloğu ("Şifreniz Sıfırlandı") yeni kurtarma koduyla birlikte kullanıcı adını da gösterir. Böylece kod doğrulamasını tamamlayan kişi kullanıcı adını unutmuşsa öğrenir — kod zaten kimlik kanıtı olduğu için yeni bir açık yaratmaz.
- **Kullanıcı adını unutmayı önleme (Login otomatik doldurma):** `getSetupState` kurulum tamamlanmışsa `username` alanını da döndürür (bekliyorsa `null`). `Login` mount'ta bunu çağırıp kullanıcı adı alanını doldurur ve odağı şifreye alır; kullanıcı normalde yalnızca şifre yazar. `location.state?.username` (ör. devir sonrası yönlendirme) varsa ona öncelik verilir ve sorgu atlanır. Alan düzenlenebilir kalır (tek hesap olduğundan dolan değer her zaman doğrudur).
- Giriş yapmış hesap Profile'dan `regenerateRecoveryCode(password)` ile (mevcut şifre doğrulanarak) yeni kod üretir.
- `recovery_hash` bcrypt ile, tek hesapta saklanır.

### Hesap Yönetimi (Profile sayfası)

Silinen admin panelinin yerini **Profile (`/profile`)** aldı — tek hesabın tüm yönetimi burada:

- **Şifre değiştir:** `changePassword(userId, oldPassword, newPassword)` (mevcut şifre doğrulanır).
- **Yeni kurtarma kodu üret:** `regenerateRecoveryCode(password)`.
- **Hesabı Devret:** `transferAccount(userId, password, newPerson)` — giriş yapmış hesabın **kendini** devretmesi: mevcut şifre doğrulanır, `manager_name` yeni kişiye set edilir, tek kullanımlık geçici şifre üretilir (bir kez modalda gösterilir). Binalar/veriler aynı hesapta kalır. Devir sonrası eski şifre geçersiz olur → renderer oturumu kapatıp `/login`'e atar. (Şifre unutulursa yedek yol `/recover`.)
- **Binalarım:** `listBuildings/renameBuilding/updateBuildingStatus` — binaları yeniden adlandır/arşivle/geri getir. Bina **silinmez, arşivlenir** (`is_active=0`); arşiv seçicide görünmez, Profile'dan geri getirilir.
- Login'de timing attack koruması: kullanıcı bulunamasa da sahte hash karşılaştırması yapılır.

---

## 7. Veritabanı

### 7.1 Bağlantı ve Pragma'lar (`database/db.js`)

- **Tek bağlantı**, main process'te, modül yüklenirken açılır. Dev'de dosya proje kökünde (`database.db`), paketli sürümde `%APPDATA%/mavikent-site-yonetimi/` (userData) altındadır
- Pragma'lar: `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=3000`, `cache_size=-16000` (16 MB), `temp_store=MEMORY`
- `closeDb()`: `optimize` + `wal_checkpoint(TRUNCATE)` + `close`. `before-quit`'te otomatik çağrılır; restore işlemi dosya kilidini bırakmak için elle çağırır
- better-sqlite3 **senkron** çalışır — sorgular event loop'u bloklar. Uzun sorgu yazma; listeler büyürse sayfalama ekle (ROADMAP)

### 7.2 Şema

```sql
users                 (id, username, email, manager_name, password_hash, recovery_hash, is_active,
                       last_login, password_changed_at, created_at, updated_at)
                       -- manager_name: hesabı kullanan kişinin adı (2-60, opsiyonel); Profile'da/karşılamada gösterilir (bkz. §17 ADR #25)
                       -- email: UNIQUE ve NOT NULL DEĞİL (012). Kimlik/kurtarma işlevi yok (giriş kullanıcı adıyla,
                       --   kurtarma kodla); yalnızca bilgi amaçlı, isteğe bağlı iletişim alanı. Kurulumda seed NULL yazar
                       --   (eski sabit yer tutucu e-posta 019 ile NULL'landı); kullanıcı Profile'dan updateEmail ile
                       --   kendisi girer/temizler
                       -- recovery_hash: hesabın kurtarma kodunun bcrypt hash'i (tek kullanımlık)
                       -- password_changed_at NULL = setup tamamlanmamış
                       -- is_active: bugün YAZILMIYOR (hep 1); login + createBuilding owner kontrolünde okunur. Bilinçli
                       --   olarak KALDIRILMADI: ileriki hesap devri "yeni satır + eski satırı is_active=0" modeliyle
                       --   yapılırsa (geçmiş collected_by/cancelled_by bağları kişi bazında korunur) bu kolon gerekir
                       --   (bkz. ROADMAP — hesap devri). Devir bugünkü modelde satırı yerinde overwrite eder (transferAccount)
                       -- role ve display_name kalıntı kolonları 018 ile kaldırıldı (tek hesap, rol yok — ADR #26)

buildings             (id, owner_id→users.id, name CHECK(len 2-60), is_active,
                       created_at, updated_at)
                       -- Defterin sahibi varlık. Bir kişi (owner_id) birden fazla bina yönetebilir (ADR #25)
                       -- Kullanıcı giriş yaptıktan sonra binayı kendi oluşturur (SelectBuilding). Silinmez, arşivlenir (is_active=0)

apartments            (id, apartment_no UNIQUE NOCASE per building_id, floor,
                       type∈{0+1,1+1,2+1,3+1,4+1}, square_meters,
                       due_amount, is_active, building_id→buildings.id, created_at, updated_at)

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
                       building_id→buildings.id, due_payment_id→due_payments.id UNIQUE,
                       cancelled_by→users.id, created_at, updated_at)

expenses              (id, amount, date, description,
                       category∈{maintenance,cleaning,utility,staff,other},
                       is_cancelled, cancelled_at, cancel_reason,
                       building_id→buildings.id, cancelled_by→users.id, created_at, updated_at)
```

### 7.3 Migration / Schema Sistemi (`database/migrate.js`)

`runMigrations()` her başlangıçta çalışır, sırası:

1. **`database/migrations/`** — uygulanmamış dosyalar ada göre sıralı, her biri kendi transaction'ında çalışır ve `migrations` tablosuna kaydedilir. Detaylar:
   - Migration sırasında `foreign_keys=OFF`; sonunda `foreign_key_check` yapılır, ihlal varsa rollback
   - `duplicate column name` hatası "zaten uygulanmış" sayılır ve kaydedilir (idempotent kurtarma)
   - **Fresh install:** `users` tablosu yoksa tüm migration'lar çalıştırılmadan "uygulandı" işaretlenir — tabloları schema aşaması güncel haliyle oluşturur
2. **`database/schema/`** — `CREATE TABLE/TRIGGER IF NOT EXISTS` ile yüklenir; mevcut kurulumda no-op

| Durum                              | Ne yapılır                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yeni tablo                         | `database/schema/NN_tablo.sql` oluştur (ör. `09_yeni_tablo.sql`)                                                                                                                                |
| Mevcut tabloya sütun/index/trigger | `database/migrations/NNN_aciklama.sql` **VE** ilgili `schema/` dosyasını da aynı hale getir (fresh install ile mevcut kurulum aynı şemada buluşmalı — v1.1.8'deki kolon kayması bug'ının dersi) |
| CHECK constraint değişikliği       | SQLite `ALTER ... CHECK` desteklemez → tablo yeniden oluşturma migration'ı (örnek: `001_due_payments_raise_amount_limit.sql`)                                                                   |
| Tablo silme/yeniden adlandırma     | Önce kullanıcıya sor                                                                                                                                                                            |

**Migration yazım kuralları:** dosya salt SQL'dir (JS migration yok); geri alma (down) mekanizması yoktur — geri dönüş yeni bir migration ile yapılır; migration bir kez release edildiyse **asla düzenlenmez**, yeni dosya eklenir.

### 7.4 SQL Yazım Standartları

- Her sorgu **prepared statement** (`db.prepare(...).run/get/all`) — string birleştirme ile SQL üretme; dinamik filtre gerekiyorsa WHERE parçalarını koşullu kur, değerleri her zaman parametre olarak geçir
- Birden fazla yazma içeren işlemler `db.transaction(() => {...})()` içinde
- Manager verisi sorgularında `manager_id = ?` filtresi zorunlu (bkz. §5.2 madde 5)
- Para `REAL` saklanır (bilinçli karar: TL tutarları, tek kullanıcılı defter — kuruş hassasiyeti toplamalarda `ROUND` ile yönetilir); ekranda `toLocaleString("tr-TR")` + `₺` ile formatlanır (paylaşılan bir para yardımcısı yoktur — her sayfa kendi içinde formatlar)
- Tarihler ISO-8601 `TEXT` (`YYYY-MM-DD` veya `datetime('now', '+3 hours')`)
- **Saat dilimi:** Tüm otomatik zaman damgaları **Türkiye yerel saati (UTC+3)** ile saklanır. Türkiye 2016'dan beri DST kullanmadığından sabit `+3 hours` deterministiktir. Kural: her `created_at/updated_at/cancelled_at/last_login/...` yazımı `datetime('now', '+3 hours')` kullanır (schema DEFAULT'ları, trigger'lar ve INSERT/UPDATE'lerde açıkça). Kullanıcının seçtiği takvim tarihleri (`date`, `payment_date`, `move_in_date`, `move_out_date`) kaydırılmaz. JS tarafında "bugün"/"şu an" da TR bazlıdır (`new Date(Date.now() + 3*3600*1000)`; bkz. `date.js` `getToday`). Okuma tarafı (`date.js`) saklanan değeri **olduğu gibi yerel** parse eder — ikinci bir UTC→yerel çevrimi yapılmaz. Eski UTC veriler `010_shift_timestamps_to_tr_time.sql` ile +3 saat kaydırıldı.

---

## 8. Kritik İş Kuralları

1. **Aidat kaydı silinemez** — yalnızca düzenlenebilir.
2. **`getDuesForMonth`** — aidat kaydı olmayan aktif daireler `LEFT JOIN` + `COALESCE(d.due_amount, a.due_amount)` ile **sanal** (persist edilmemiş) olarak listelenir; okuma sırasında `dues` satırı **oluşturulmaz**. Gerçek `dues` satırı yalnızca ödeme anında `recordPayment` içinde `INSERT OR IGNORE` ile (o anki `apartments.due_amount` ile) oluşur.
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
    - Geri yükleme: seçilen dosyada `integrity_check` → onay → mevcut DB `.bak`'a kopyalanır → `closeDb()` (Windows dosya kilidi için) → kopyala → eski `-wal/-shm` silinir (yeni DB'ye replay olmasın) → `app.relaunch()`. Hata olursa `.bak`'tan geri dönülür ve **bu yolda da `app.relaunch()` çağrılır** — `closeDb()` sonrası bağlantı yeniden açılmadığından, uygulama ölü bağlantıyla kalmasın diye geri yüklenen dosyayla temiz başlatılır.

---

## 9. Validasyon Katmanları

Her IPC çağrısı üç katmanda doğrulanır — **değişiklik yaparken üç katmanı da güncelle**:

| Katman     | Dosya                            | Ne kontrol eder                                                                                                |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. Bridge  | `preload.js`                     | Kanal whitelist, temel tip/null guard                                                                          |
| 2. Handler | `electron/modules/*/handlers.js` | Alan varlığı, tip, aralık, format (regex, enum), rezerve değerler — `safeHandler(fn)` içindeki `fn`'de yapılır |
| 3. DB      | `database/schema/*.sql`          | CHECK, NOT NULL, UNIQUE, FK, trigger                                                                           |

Handler katmanı asıl güvenlik sınırıdır (preload atlatılabilir varsayılır). DB katmanı son savunma hattıdır — CHECK ihlali service'teki `resolveDbError` ile Türkçe mesaja çevrilir; ortak `safeHandler` yalnızca beklenmeyen (throw edilen) hataları jenerik mesaja çevirir (bkz. §5.2 madde 3).

**Handler ↔ şema paritesi (kural):** Handler validasyonu, ilgili sütunun `CHECK` kısıtındaki aralık/format/enum'u **birebir yansıtmalıdır**. Amaç: sınır dışı girdi jenerik DB hatası yerine handler'da düzgün Türkçe mesajla yakalansın. Şemadaki bir CHECK'i değiştirirken handler'daki eş kontrolü de güncelle. Mevcut parite noktaları:

- `apartment` → daire no (1-10, harf/rakam), kat (-2..99), metrekare (0<x≤1000), aidat (0<x≤50000). **Sakin alanları apartment'ta değil `resident` handler'ında doğrulanır.**
- `resident` → telefon (≥10, `[0-9+()- ]`), e-posta (ASCII, `@` + `.`, ≥5), TC (11 hane), sakin türü (`owner,tenant`), giriş/çıkış tarihi (geçerli ISO tarih + `çıkış ≥ giriş`), çıkış (move-out) tarihi (geçerli ISO)
- `auth` (ADR #26 sonrası) → `login` kullanıcı adı + şifre zorunlu; `completeSetup` kullanıcı adı `[A-Za-z0-9_]{3,}` + şifre ≥8 + `managerName` 2-60 (setup UI zorunlu kılar); `transferAccount` → `userId` pozitif tamsayı + `password` + `newPerson` (2-60); `changePassword` → `userId` + eski/yeni şifre (≥8); `updateEmail` → `userId` pozitif tamsayı + `email` (boş/null = kaldır, doluysa 5-254 + `@`/`.` içeren format); `resetAccountPassword` → `recoveryCode` + yeni şifre (≥8); `regenerateRecoveryCode` → `password`
- `building` → bina adı (`name`) 2-60 zorunlu, `ownerId`/`buildingId` pozitif tamsayı
- `dues` → ödeme tutarı (0<x≤1.000.000), not ≤500, iptal nedeni ≤300, ödeme tarihi (ISO + `≥2000-01-01`)
- `financial` → tutar (0<x≤1.000.000), açıklama ≤500, tarih (ISO + `≥2000-01-01`), iptal nedeni ≤300, kategori enum (gelir: `dues,other`; gider: `maintenance,cleaning,utility,staff,other`)

**Girdi normalizasyonu (validasyondan önce):** Kullanıcı metin alanları handler katmanında, **validasyondan önce** in-place `trim()` edilir; böylece hem validasyon (anchored regex boşluğa takılmaz) hem de DB'ye yazılan değer kırpılmış olur. Kural: **normalize tek yerde, handler'da yapılır — service tekrar trim'lemez.**

- `apartment/handlers.js` → `normalizeApartmentData` (`TRIMMED_FIELDS` listesi: yalnızca `apartment_no`), `ADD` ve `UPDATE` yollarında çağrılır.
- `resident/handlers.js` → `normalizeResidentData` (tüm sakin string alanları: `full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes`), `ADD` ve `UPDATE` yollarında çağrılır.
- `auth/handlers.js` → `normalizeIdentityFields` (`username`, `email`) `LOGIN`'de; `COMPLETE_SETUP`'ta `managerName`, `TRANSFER_ACCOUNT`'ta `newPerson` trim'lenir.
- `financial/handlers.js` → `normalizeFinancialData` (`TRIMMED_FIELDS`: `description`, `category`), `ADD_INCOME` ve `ADD_EXPENSE` yollarında çağrılır; **service (`insertRecord`) tekrar trim'lemez.**
- **Şifreler asla trim'lenmez** (baştaki/sondaki boşluk kasıtlı olabilir).
- `dues`/`financial` `reason` (iptal nedeni) alanları handler'da `.trim()` ile kırpılıp service'e öyle geçirilir.

---

## 10. electronAPI — IPC Endpoint Özeti

| Grup                   | Metodlar                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apartment              | `addApartment`, `updateApartment`, `deleteApartment`, `bulkUpdateDueAmount` (hepsi `buildingId` ile bina-scoped)                                                        |
| Auth                   | `login`, `changePassword`, `updateEmail({userId,email})` (Profile, isteğe bağlı; boş = kaldır), `transferAccount({userId,password,newPerson})` (self-service devir), `resetAccountPassword` (/recover, oturumsuz), `regenerateRecoveryCode`, `getSetupState`, `completeSetup({password,managerName})` |
| Building               | `listBuildings(ownerId)`, `createBuilding({ownerId,name})`, `renameBuilding`, `updateBuildingStatus` (owner_id ile sahiplik doğrulanır; bina silinmez, arşivlenir)     |
| Dashboard              | `getStats(buildingId)`                                                                                                                                                  |
| Dues                   | `getDuesForMonth(buildingId)`, `recordPayment`, `cancelPayment` (`buildingId` sahiplik + `userId` iptal eden), `getPaymentHistory` (`dueId` + `buildingId`)             |
| Financial              | `addIncome`/`addExpense` (`buildingId`), `getTransactions(buildingId)`, `cancelIncome`/`cancelExpense` (`buildingId` sahiplik + `userId` iptal eden)                    |
| Reports                | `getReportData(buildingId)`, `saveReportFile`                                                                                                                          |
| Resident               | `getResidentsOverview(buildingId)`, `getResidentHistory` (`buildingId`), `addResident`/`updateResident`/`moveOutResident` (`buildingId`)                               |
| System                 | `getAppVersion`                                                                                                                                                         |
| Events (main→renderer) | `onToggleTheme`                                                                                                                                                         |

Kanal adları için tek kaynak: `electron/ipc/channels.js`.

---

## 11. React / Renderer Mimarisi

- **Routing:** HashRouter (Electron `file://`/`app://` uyumu için — BrowserRouter kullanma). Rotalar `App.jsx`'te, tüm sayfalar `lazy()` + `Suspense`
- **State yönetimi:** Global state kütüphanesi **yoktur** (bilinçli karar — uygulama küçük). Sayfa state'i lokal `useState`/`useEffect`; oturum `sessionStorage` + `useCurrentUser`; **seçili bina** `sessionStorage` + `useCurrentBuilding`; tema `useTheme` (CSS değişkenleri + `onToggleTheme` IPC eventi)
- **Bina bağlamı (manager):** Giriş sonrası kullanıcı her zaman `/select-building`'e yönlenir (giriş/koruma yönlendirmeleri bu sabit yolu doğrudan kullanır), bina seçer/oluşturur → `setCurrentBuilding` → `/dashboard`. Manager sayfaları `RequireBuilding` guard'ı altındadır. **Building-scoped `electronAPI` çağrıları `user.id` değil seçili `building.id`'yi geçer**; yalnızca işlemi yapan kişiyi kaydeden alanlar (`collected_by`, iptal `userId`, `changePassword`) `currentUser.id` kullanır. Dashboard başlığı + Reports PDF başlığı = `building.name`. (Eskiden bina = `user.displayName`'di; bkz. §17 ADR #25)
- **Veri çekme deseni:** sayfa mount'ta `electronAPI` çağırır, `res.success` kontrol eder, hata mesajını SweetAlert ile gösterir. Cache katmanı yok — her sayfa girişinde taze veri
- **Alert/Dialog:** SweetAlert **yalnızca `src/utils/alert.js`'te** kullanılır — sayfalar/bileşenler `sweetalert2`'yi import etmez, `showAlert` metodlarını çağırır. Yeni bir dialog gerekiyorsa `alert.js`'e metod ekle (tema renkleri, `heightAuto:false` ve buton gelenekleri orada tek noktada). `swalBase`/`swalColors` export'ları kaldırıldı.
  - **Dönüş sözleşmesi:** `confirm`/`confirmDanger` ham `SweetAlertResult` değil **`boolean`** döner (`if (confirmed)` — `result.isConfirmed` yazma). `prompt`/`cancelReason`/`passwordPrompt` değeri döner, vazgeçilirse `null`. Yeni bir dialog metodu eklerken bu deseni koru: çağıran SweetAlert'in sonuç nesnesini görmemelidir.
  - **Trim:** `prompt` ve `formDialog` girdileri **her zaman** trim'lenir; tek istisna `type/input: "password"` alanlarıdır (baştaki/sondaki boşluk kasıtlı olabilir — §9 ile aynı kural). Opt-in `trim` bayrağı yoktur, çağrı yerinden trim geçme.
  - **Genişlik:** Diyalog metodları amaca özel genişlik taşır (varsayılan 42em) — paylaşılan bir metodu büyütmek yerine daha geniş bir diyalog için kendi metodunu ekle (ör. `releaseNotes()` → 54em, madde listeleri 42em'de kötü sarıyordu).
  - **Dialog stilleri `style.css`'te**, `swal-*` sınıflarında tutulur (`swal-code`, `swal-copy-row`, `swal-copy-button`, `swal-copy-note`) — `alert.js`'in ürettiği HTML'e inline `style="font-size:..."` yazma.
  - **Kurtarma kodu diyalogları** (`setupCode`/`resetCode`/`regeneratedCode`) panoya **otomatik yazmaz**; kullanıcı "Kodu Kopyala" butonuna basar, sonuç yan nota yazılır. Kullanıcı istemeden panosuna dokunma.
- **Formatlama:** tarih/saat için `src/utils/date.js`. Bu dosya tarih alanının tek sahibidir: `MONTHS` (Türkçe ay adları), `formatMonthYear(year, month)`, `getToday`/`getCurrentYear`/`getCurrentMonth` (hepsi TR bazlı) ve `formatDate`/`formatDateShort`/`formatTime`/`formatDateTime` buradan gelir. **Kural:** "bugün/şu anki yıl/ay" için renderer'da ham `new Date()` kullanma (makine saat dilimine bağlı kalır — §7.4); ay adı dizisini sayfa içinde tekrar tanımlama. Formatlayıcılar boş/geçersiz girdide `"—"` döner, çağıran tarafta elle null kontrolü gerekmez (ham ISO değeri ekrana basma — `move_in_date` gibi tarih alanlarını da bu formatlayıcılardan geçir). Saat içermeyen bir değere `formatTime` verilirse `"—"` döner (uydurma `00:00` üretmez); `formatDateTime` de bu durumda yalnızca tarihi döndürür. Para formatlama paylaşılan bir yardımcıda değildir — kullanan sayfa `toLocaleString("tr-TR")` ile kendisi formatlar
- **Sabitler:** paylaşılan bir `utils/constants.js` **yoktur** — her sabit onu kullanan modülde tanımlanır (`THEME_KEY`/`VALID_THEMES` → `useTheme.js`, `SESSION_USER_KEY` → `useCurrentUser.js`). Birden fazla modülden kullanılan sabit, sahibi olan modülden export edilir. Sabitler için ayrı bir çöplük dosyası açma
- **Tema:** light/dark, `style.css` içindeki CSS değişkenleri; bileşen CSS'lerinde renkleri değişken üzerinden kullan, hex sabitleme. **Değişken eşiği:** yeni bir CSS değişkeni yalnızca **gerçekten gerekliyse** tanımlanır — bir değer aynı dosyada **birden fazla yerde** kullanılıyorsa veya temaya göre değişiyorsa değişken olur; tek yerde geçen ve temadan bağımsız bir değer için değişken açma (gereksiz token kalabalığı istenmiyor, literal yaz). Accent türevleri `--accent-focus-ring / --accent-selection / --accent-tint` ailesindedir. **Temalar arası tek fark renktir:** iki tema aynı değişken setini aynı anahtarlarla tanımlar; birinde olup diğerinde olmayan gölge/katman/kalınlık **olmaz**. Bunu garantilemek için geometri (offset, blur, spread, `1px solid`, katman sayısı) kuralın içinde literal yazılır, değişken **yalnızca rengi taşır** — `box-shadow: 0 3px 16px var(--x-glow)` doğru, `box-shadow: var(--x-glow)` yanlıştır (ikincisinde bir tema iki katman, diğeri tek katman tanımlayabilir ve fark sessizce kalıcılaşır). Aynı sebeple `[data-theme="light"]` altında yapısal override (farklı `box-shadow` yapısı, farklı `border-width`) yazma; yalnızca değişken değeri ezilir. **Not:** boşluk/köşe yarıçapı için token ölçeği (`--space-*`, `--radius-*`) yoktur — literal px değerleri kullanılır. `style.css` yalnızca global reset + tema değişkenleri + temel eleman stillerini (body, tipografi, buton, form, scrollbar, toast) barındırır; **paylaşılan `.u-*` yardımcı sınıfı yoktur** (kullanılmadıkları için kaldırıldı — yeni sayfa stilini kendi CSS dosyasında yaz).
- **Şifre alanları:** Her şifre girişi (`Login`, `Setup`, `Recover`) `<CapsLockIndicator />` içerir — alan içinde, göster/gizle butonunun solunda beliren "Büyük Harf" rozeti. Durum takibi bileşenin kendi `useCapsLockOn()` hook'undadır; sayfa **kendi `capsLockOn` state'ini tutmaz, input'a `onKeyUp/onKeyDown/onBlur` bağlamaz**. Hook `document` üzerinde dinler (odak dışı tuş/fare olayları da güncellenir); alan `onBlur`'ünde sıfırlama yapılmaz, çünkü Caps Lock odak kaybedince kapanmıyor. Uyarı **kutulu bir hata bloğu değildir** — kırmızı hata kutusuyla aynı forma sahip olması "bir şeyi yanlış yaptın" izlenimi veriyordu ve belirip kaybolurken altındaki ölçer/kural listesini zıplatıyordu; zeminsiz ve çerçevesiz rozet konumlandırılmış olduğu için akışta yer kaplamaz. Tam cümle `title` + `aria-label`'dadır. Göster/gizle her şifre alanında ayrı state ile çalışır (kullanıcı genelde tek alanı açmak ister)
- **Okunabilirlik (hedef kitle):** Kullanıcıların çoğunluğu **40+ yaş** apartman yöneticileridir. **Alt sınır 1rem'dir** (önceki ~0.9rem eşiği 2026-07-20'de yükseltildi): gövde, etiket, giriş alanı, buton ve tablo hücresi metni 1rem'in altına inmez. Uzun bir metni tek satıra sığdırmak için fontu küçültme; metni sar, kısalt ya da kapsayıcıyı genişlet (küçük font okunabilirliğe feda edilmez).
  - **Mevcut durum (2026-07-25):** `src` genelinde 1rem (16px) altında **94 tanım / 14 dosya** var (en yoğun: `Apartments.css` 23, `Residents.css` 13, `Reports.css` 10, `Transactions.css` 10, `Profile.css` 8, `Footer.css` 7). `AdminDashboard` sayfası ADR #26 ile **tamamen kaldırıldı** (dosyaları silindi); işlevleri `Profile`'a taşındı ve `Profile.css` hâlâ 8 adet 1rem-altı tanım taşır (o sayfaya dokunulduğunda yükseltilecek). Bunlar bilinçli olarak **toplu düzeltilmedi** — yoğun tablo sayfalarında satır yüksekliği/sütun genişliği değişeceği için her sayfa kendi içinde ve gözle doğrulanarak taşınmalıdır. Kural **yeni yazılan koda derhal uygulanır**; eski sayfalar o sayfaya dokunuldukça yükseltilir. Bir sayfayı düzelttiğinde buradaki sayıyı güncelle.
  - Eşiği tam karşılayan sayfalar: `Login` (en küçük metin 1.05rem), `Setup` (1rem), `Recover` (1rem). Not: üçü de `CapsLockIndicator`'ı kullanır ve o paylaşılan bileşenin rozet metni 0.88rem'dir (alan içinde göster/gizle butonuyla yer paylaştığı için ayrı değerlendirilmelidir). `Setup` alanları **floating-label** kullanır (`.setup-float-label`): etiket boş/odaksız alanda placeholder gibi 1.08rem ortadadır, alan dolunca/odaklanınca yukarı kayıp 0.85rem'e küçülür — bu küçülme floating-label deseninin doğası gereğidir (yukarıdaki rozet gibi ayrı değerlendirilir), gövde/tablo metni değildir.

### Rotalar

| Rota                 | Bileşen          | Rol                                                                 |
| -------------------- | ---------------- | ------------------------------------------------------------------- |
| `/login`             | Login            | —                                                                   |
| `/setup`             | Setup            | — (yalnızca `needsSetup` iken)                                      |
| `/recover`           | Recover          | — (hesap şifre sıfırlama, iki adımlı)                               |
| `/select-building`   | SelectBuilding   | auth (giriş sonrası **her zaman** açılır; bina seç ya da oluştur)   |
| `/dashboard`         | Dashboard        | auth (`RequireBuilding` guard'ı: bina seçilmemişse `/select-building`'e atar) |
| `/add-apartment`     | AddApartment     | manager                                                             |
| `/apartments`        | Apartments       | manager (salt-okunur aidat/daire görüntüleme)                       |
| `/apartments/manage` | ApartmentsManage | manager (daire işlemleri: düzenle/sil/ödeme/toplu aidat — modallar) |
| `/residents`         | Residents        | manager                                                             |
| `/add-income`        | AddIncome        | manager                                                             |
| `/add-expense`       | AddExpense       | manager                                                             |
| `/transactions`      | Transactions     | manager                                                             |
| `/profile`           | Profile          | manager                                                             |
| `/reports`           | Reports          | manager                                                             |

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
2. **Yama notları (`src/utils/releaseNotes.js`) güncellenmeli** — yeni sürüm yayınlanmadan önce uygulama içi sürüm notları da güncellenir (Footer'daki "Sürüm Notları" modalında gösterilir). Kural: **yalnızca son 3 yama** listede kalır — yeni sürümü diziye **başa** ekle, en eski (4.) kaydı sil. Her kayıt `{ version, date (YYYY-MM-DD), title, changes: [...] }` biçimindedir; `version` `package.json` ile aynı olmalı, `changes` kullanıcıya dönük kısa Türkçe maddelerdir.
3. Commit mesajı geleneği: `feat: vX.Y.Z — kısa Türkçe açıklama` / `fix: vX.Y.Z — ...`
4. `npm run dist` → `dist_electron/Mavikent-Site-Yonetimi-Setup-X.Y.Z.exe`
5. GitHub Release oluştur (tag `vX.Y.Z`); `electron-updater` `latest.yml` + installer'ı release asset'lerinden okur
6. Otomatik güncelleme: açılışta kontrol (20 sn timeout, indirme için 60 sn stall watchdog — internet yoksa/yavaşsa uygulama açılmaya devam eder). Kullanıcı "Şimdi Yeniden Başlat" derse `quitAndInstall`

### Build Ortam Notları (Windows)

- NSIS build'i `TMP=C:\WINDOWS\TEMP` gibi anormal temp değişkenlerinde bozulur — build öncesi TMP/TEMP'in kullanıcı temp'ine işaret ettiğini doğrula
- `setAppUserModelId` çağrısı görev çubuğu ikonunun boş çıkmasına neden olmuştu — ekleme
- `asarUnpack: **/*.node` — better-sqlite3 native binary'si asar dışında kalmalı

---

## 16. Debugging Notları

| Sorun                        | Bakılacak yer                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Uygulama açılmıyor (prod)    | `%APPDATA%/mavikent-site-yonetimi/logs/main.log`                                 |
| "Blocked IPC channel" hatası | Kanal `channels.js`'te tanımlı mı? Preload güncellenmiş mi?                      |
| Migration hatası             | `main.log` + `migrations` tablosu içeriği; migration transaction'ı rollback olur |
| DB kilitli (Windows)         | WAL dosyaları + başka instance kontrolü; `busy_timeout=3000` var                 |
| Dev'de sıfırdan başlama      | `npm run reset-db` (3 dosyayı birden siler — tek tek silme)                      |
| DevTools                     | Menü → DevTools (dev modda)                                                      |
| Güncelleme test              | Yalnızca paketli sürümde çalışır (`isDev` kontrolü); dev'de update akışı atlanır |

---

## 17. Mimari Karar Kayıtları (ADR Özeti)

| #   | Karar                                                                                                                                                                  | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | better-sqlite3 (senkron) main process'te                                                                                                                               | Offline, tek kullanıcı, transaction garantisi basit; async ORM karmaşıklığı gereksiz                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | Handler/service ayrımı, domain bazlı modüller                                                                                                                          | Validasyon ile SQL'i ayırmak; her domain tek klasörde (v1.1.7 refactor)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | Kanal sabitleri tek dosyada + preload whitelist                                                                                                                        | Kanal adı typo'su açılışta yakalanır; renderer keyfi kanal çağıramaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Soft-delete + immutable audit (`payment_cancellations`)                                                                                                                | Finansal kayıtlar izlenebilir olmalı; silme yerine iptal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5   | `paid_amount` = aktif ödemelerin SUM'ı                                                                                                                                 | Artımlı güncelleme drift yaratır; yeniden hesap idempotenttir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | Update kontrolü migration'lardan önce                                                                                                                                  | Bozuk migration içeren sürüm güncellemeyle kurtarılabilsin (v1.1.9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | Global state kütüphanesi yok                                                                                                                                           | Sayfa başına lokal state yeterli; bağımlılık maliyeti fayda getirmiyor                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Para `REAL`                                                                                                                                                            | TL defteri, tek kullanıcı; kuruş hassasiyeti ROUND ile yönetilir. Hassas muhasebe gerekirse kuruş-integer'a migration düşünülür                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | HashRouter                                                                                                                                                             | Paketli Electron'da `file://`/custom protocol altında BrowserRouter path'leri kırılır                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | Setup akışı: `SETUP_PENDING` sentinel + zorunlu ilk kurulum ekranı                                                                                                     | Varsayılan şifre riski sıfırlanır; kurtarma kodu bir kez gösterilir (v1.2.0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 11  | Ortak `safeHandler` zarfı (`electron/modules/shared/safeHandler.js`)                                                                                                   | Her handler'daki tekrar eden try/catch + loglama + `event` yutma boilerplate'i tek yerde toplanır; handler'lar yalnızca validasyon + service çağrısına odaklanır                                                                                                                                                                                                                                                                                                                                                                                    |
| 12  | Sakin yönetimi ayrı `resident` domain + `/residents` sayfası; merge-form sezgisi yerine açık aksiyonlar                                                                | `updateApartment`'a gömülü üç yönlü sakin dallanması (`isResidentReplacement`) sorumlulukları karıştırıyor ve kısmi güncellemede veri kaybı riski taşıyordu. Ekle/Düzenle/Çıkış/Geçmiş açık aksiyonları kullanıcı niyetini tahmin etmeye gerek bırakmaz; daire formları yalnızca daire tutar                                                                                                                                                                                                                                                        |
| 13  | `resolveDbError` ortaklaştırıldı — `createDbErrorResolver(columnLabels)` (`electron/modules/shared/dbError.js`)                                                        | `apartment`, `financial`, `resident` service'lerinde tekrar eden UNIQUE/CHECK/NOT NULL/FK → Türkçe mesaj çevirisi tek yerde toplanır; her domain kendi `columnLabels` sözlüğüyle resolver üretir                                                                                                                                                                                                                                                                                                                                                    |
| 14  | Apartments sayfası `Apartments.jsx` (salt-okunur liste) ve `ApartmentsManage.jsx` (daire işlemleri) olarak ikiye bölündü                                               | Tek dosya 700+ satıra ulaşmıştı (ROADMAP T1); okuma ve yönetim sorumlulukları ayrışınca her dosya küçülüp bakımı kolaylaştı — ortak parçalar `components/`, `constants.js`, `useDues.js`'e taşındı                                                                                                                                                                                                                                                                                                                                                  |
| 15  | Arka plan görseli **yalnızca giriş ekranlarında** (login/setup/splash) kullanılır; iç sayfalarda yoktur. Görsel dili **soyut mimari çizgi işi**, fotoğraf/render değil | Fotoğraf spesifik olmak zorundadır ve spesifik olduğu an kullanıcıların çoğuyla uyuşmaz (eski login görselleri gökdelen ve lüks villaydı); ayrıca detay/kontrast metin okunabilirliğini düşürür ve tema başına ayrı çekim gerektirdiği için iki tema iki farklı sahne anlatır. Soyut çizgi işi nötr, düşük detaylı ve tek motifin renk çevrimiyle iki temaya eşlenebilir. İç sayfalar günde onlarca kez açılan tablo/rakam ekranlarıdır — arka plan görseli orada kontrastı düşürür ve tekrar gördükçe gürültüye dönüşür (§11 okunabilirlik kuralı) |

| 16 | Admin şifre kurtarma SweetAlert formundan ayrı `/recover` sayfasına taşındı; iki adımlı, yeni IPC endpoint'i olmadan | Tek modalde kod + şifre isteniyordu: şifre tekrarı, göster/gizle ve Caps Lock uyarısı yoktu — kullanıcı göremediği şifreyi yanlış yazarsa tek kullanımlık kod harcanmış ve uygulamaya girilemez oluyordu. Kod alanı da ham `text`'ti (maske/otomatik büyük harf yok). Kod doğrulaması için ayrı bir `verifyRecoveryCode` endpoint'i **bilinçli olarak eklenmedi**: brute-force oracle'ı yaratır ve gereksizdir — adım 1 yalnızca format doğrular, iki adımın state'i tek bileşende tutulduğu için hatalı kodda şifre kaybolmaz |

| 17 | Setup sayfası teal paletten **login ile aynı mavi aileye** geçirildi (dark `--setup-accent: #38a5f7`, light `#1d4ed8`) | Logo mavi gradyandır (`#29c1fb → #1240f0`) ve `--login-accent` (`#38a5f7`) ile aynı aileden; teal olan tek şey Setup'tı. Setup ve login arka arkaya gelen ekranlardır (kurulum biter bitmez `/login`'e yönlendirilir), iki farklı aksan rengi aynı uygulama hissini zayıflatıyordu. Logoyu sayfaya uydurmak yerine sayfa markaya uyduruldu. Şifre gücü ölçerinin kırmızı→yeşil renkleri **tema değil anlam** taşıdığı için dokunulmadı |

| 18 | `prop-types` bağımlılığı ve tüm `Component.propTypes` blokları kaldırıldı (2026-07-20); yerine TypeScript **gelmedi**, prop doğrulaması yok | React 19 `propTypes` denetimini paketten çıkardı: tanımlar sessizce yok sayılıyor. Ölçüldü (React 19.2.7, `renderToString` + kasıtlı yanlış tip) → hiçbir uyarı üretilmedi. Yani 13 tanımın tamamı ölü koddu; çalışmayan bir denetimi tutmak, var olmayan bir korumaya güvenmek demektir. Zorunlu object/func prop'lar eksik geçilirse bileşen zaten anında çöker; `ProtectedRoute`'un `oneOf(VALID_ROLES)` kontrolü de gerçek bir açık kapatmıyordu — `hasRole` katı eşitlik yaptığı için hatalı rol **kapalı tarafa** düşer (erişim reddedilir). Yerine konsola yazan bir guard denendi ve kaldırıldı: hatalı rol zaten ekranda "Erişim reddedildi" toast'ı + yönlendirme olarak görünüyor, rotalar tek dosyada ve iki rol var |
| 19 | Caps Lock uyarısı paylaşılan `CapsLockIndicator` + `useCapsLockOn` ikilisinde; **alan içi rozet**, metin bloğu değil | Uyarı üç sayfada (Login/Recover/Setup) birebir aynı CSS ile kopyalanmıştı. Kutulu biçim iki sorun taşıyordu: kırmızı hata kutusuyla aynı forma sahip olduğu için hata sanılıyordu ve belirip kaybolurken altındaki içeriği zıplatıyordu. Durum takibinin sayfada tutulması ayrıca hataya açıktı — `onBlur`'de sıfırlanınca başka yere tıklamak uyarıyı Caps Lock hâlâ açıkken kapatıyordu; `document` dinleyicisi bunu çözer. Setup bu uyarının en kritik olduğu ekrandır: Caps Lock açıkken iki alana da aynı şey yazıldığı için "şifreler eşleşiyor" yeşile döner, hesap büyük harfle oluşur ve kullanıcı sonradan giremez (kurtarma kodu gerekir) |

| 20 | Tema değişkenleri **yalnızca renk taşır**; geometri (offset/blur/spread, `1px solid`, katman sayısı) kuralın içinde literal yazılır | Geometri değişkenin içine gömülünce iki tema sessizce ayrışıyordu: Login/Recover/Setup'ta buton glow'u koyuda `0 3px 16px` açıkta `0 3px 14px`, kart çerçevesi koyuda `1px` açıkta `1.5px`, odak halkası koyuda iki katman açıkta tek katmandı; Footer gölgesi 12px/14px ayrılmıştı. Hiçbiri kasıtlı değildi, hepsi kopyala-yapıştır sırasında oluşup fark edilmeden kalmıştı. `box-shadow: var(--x)` yazıldığı sürece bir temaya katman eklemek serbesttir ve gözden kaçar; `box-shadow: 0 3px 16px var(--x-glow)` yazıldığında ise değişken tek bir renk yuvasıdır, yapısal sapma fiziksel olarak mümkün değildir. Aynı sebeple `[data-theme="light"]` altında yapısal override yazılmaz — bu yolla eklenmiş `.login-container` ve `.recover-container` gölge override'ları ile `.setup-welcome::after` gradyan/opacity override'ı kaldırıldı |

| 21 | Site yöneticisi şifre sıfırlama admin panelinden yapılır; admin şifre **belirlemez**, sistem 12 karakterlik geçici şifre üretir ve bir kez gösterir | Şifresini unutan site yöneticisi için hiçbir kurtarma yolu yoktu: `changePassword` mevcut şifreyi ister, `resetAdminPassword` yalnızca `role='admin'` satırına bakar. Tek çare hesabı pasifleştirip yenisini açmaktı, bu da geçmiş `collected_by` bağlarını kopuk bırakıyordu. Şifreyi admin'in yazması iki sorun doğururdu: zayıf şifre seçimi ve admin'in bir başkasının şifresini bilmesi. Üretilen şifre kurtarma kodu deseniyle aynıdır (üret, hash'le, bir kez göster). Alfabe kurtarma koduyla aynı (I/O/0/1 yok) çünkü şifre telefonda sözlü iletilecektir. Yetki için ayrı bir oturum kontrolü değil admin şifresi doğrulaması kullanıldı: IPC katmanında oturum yoktur (§5.2 madde 6) ve `regenerateRecoveryCode` zaten bu deseni kuruyordu. İlk girişte zorunlu şifre değiştirme **eklenmedi** — `password_changed_at IS NULL` sentinel'i setup akışının sahibidir, oraya ikinci bir anlam yüklemek `/setup` yönlendirmesiyle çakışırdı |

| 22 | **[GEÇERSİZ — ADR #25 ile değiştirildi]** 1 hesap = 1 bina = 1 defter; ayrı `buildings` varlığı yok, `manager_id` sahiplik anahtarı, hesap binaya ait. | Türkiye'de apartman yöneticisi genelde yılda bir değişir. Hesap kişiye ait sayılırsa her değişimde yeni hesap açmak gerekir, yeni hesap boş gelir ve geçmiş yılın daire/aidat/gelir/gider verisi eski hesapta kilitli kalır — defterin geçmişi kopar. Hesap binaya aitse değişim bir **devir** işlemidir: admin `resetManagerPassword` ile geçici şifre üretir, yeni yönetici aynı deftere devam eder (mekanizma zaten mevcuttu, ADR #21). Bunun kabul edilen bedeli `collected_by` alanının artık "kişi" değil "bina hesabı" anlamına gelmesidir; kişi bazlı iz gerekiyorsa yeri ödeme notu alanıdır. `buildings` tablosu **bilinçli olarak açılmadı**: yalnızca aynı binada iki ayrı kişi hesabı gerektiğinde anlam kazanır, karşılığında `apartments`/`incomes`/`expenses` üzerinde üç tablolu migration ve 25 sorgunun yeniden yazılması gerekir |

| 24 | **Tek bilgisayar modeli.** Uygulama tek bir makinede çalışır; veritabanı `%APPDATA%` altındadır ve senkronizasyon yoktur. Bundan çıkan kural: **hesaplar makineye özeldir.** Bir kurulumda açılan bina hesabı başka bir kurulumda **yoktur**; birden fazla bina ancak hepsi aynı bilgisayardan yönetiliyorsa anlamlıdır. Yönetici devri, yeni kişinin **aynı bilgisayarda** geçici şifreyle giriş yapmasıdır. Makineler arası tek taşıma yolu yedek dosyasıdır ve geri yükleme **tüm veritabanını** değiştirir (tek binayı ayırıp gönderme yoktur). Kullanıcıya dönük metinler bu varsayımı açıkça söyler ("bu bilgisayardaki Sistem Yöneticisi hesabı", "hesap yalnızca bu bilgisayarda geçerlidir") | Varsayım koda baştan gömülüydü ama hiçbir yerde yazılı değildi ve arayüz metinleri uzaktan işleyen bir süreç varmış izlenimi veriyordu ("Sistem Yöneticinizden geçici şifre talep edin"). Farklı bilgisayarlardaki iki kurulum iki ayrı veritabanıdır: admin'in ürettiği geçici şifre karşı makinede işe yaramaz, çünkü o kullanıcı adı orada mevcut değildir. Alternatif (makineler arası senkronizasyon) ADR #1'in offline/sunucusuz kararını geçersiz kılar ve tek kullanıcılı bir defter için karşılığı yoktur; bu yüzden model desteklenmedi, **açıkça yazıldı** |

| 25 | **1 hesap = 1 kişi (login); bir kişi N bina (defter) yönetebilir.** ADR #22'yi tersine çevirir. Ayrı `buildings` tablosu (`owner_id→users.id`, `name`); `apartments`/`incomes`/`expenses` artık `building_id→buildings.id` (eski `manager_id`). Giriş sonrası manager `/select-building` ekranından binasını seçer/oluşturur; seçili bina `useCurrentBuilding` ile `sessionStorage`'da tutulur ve building-scoped IPC çağrılarında `user.id` yerine `building.id` geçilir. `collected_by`/`cancelled_by` hâlâ `users.id`'dir (işlemi yapan kişi). Admin `createManager` yalnızca giriş hesabı açar (bina adı istemez); binayı manager kendi oluşturur. `users.display_name` manager için terk edildi, kişi adı `manager_name`'de | Bir kişi gerçekte birden fazla bloğu/binayı yönetebiliyor (ör. A sitesi E ve F blok, ya da farklı sitelerden binalar). ADR #22'de bu ancak kişi başına N ayrı hesap + N ayrı şifre ile mümkündü; giriş/çıkış ve şifre kurtarma kişi başına katlanıyor, "akış tuhaf" hissi buradan doğuyordu. Bina defterini kişiden ayırınca: tek şifreyle giriş, giriş sonrası bina seçimi, şifre kurtarma **kişi başına** sadeleşti. Binalar arası ortak rapor **yok** (her defter bağımsız, yalnızca sahibi ortak); bu yüzden `buildings` altında hiyerarşi (site→blok) kurulmadı, düz bina. Bedeli: 3 tablolu kolon-yeniden-adlandırma migration'ı (014-017) ve ~25 sorgunun `building_id`'ye taşınması — üretimde veri olmadığı için (fresh install şemadan kurulur) risk düşüktü. Devir (transferManager) hâlâ hesap bazlıdır: kişi değişiminde tüm binaları yeni kişiye geçer |

| 26 | **Tek rol.** Admin/manager düalitesi ve ikinci hesap açma mantığı kaldırıldı; bir makinede tek hesap vardır. Bu hesap binaları yönetir, kendi kurtarma kodunu tutar ve gerektiğinde **kendini devreder** (`transferAccount`). İlk ekran "Sistem Yöneticisi kurulumu" değil **genel kurulum**tur (ad soyad + şifre + kurtarma kodu). Silinen `AdminDashboard`'ın işlevleri (şifre değiştir, kurtarma kodu üret, devir, bina yönetimi) `Profile` sayfasına taşındı. `users.role` kolonu başta kalıntı olarak bırakılmıştı; sonradan `display_name` ile birlikte migration 018 ile **tamamen silindi** (tek hesap bulma artık `ORDER BY id LIMIT 1`; session'da rol yok). Kaldırılan IPC: `createManager`, `getManagers`, `updateManager`, `updateManagerStatus`, `resetManagerPassword`, `getSystemStats`. `resetAdminPassword→resetAccountPassword`, `completeAdminSetup→completeSetup`, `transferManager→transferAccount` | Kullanım profili "tek makinede tek kişi" (net karar). ADR #25 zaten bir kişinin tek hesapla N bina yönetmesini sağlamıştı; bu, ikinci hesap ihtiyacını ortadan kaldırdı. Admin katmanının tek kalan somut değeri kurtarma kodu emanetçiliğiydi ve o da tek hesapta zaten sağlanıyor. Admin'in bedeli ise çift-giriş dansıydı (admin'e gir → kendine manager aç → çık → manager gir). Rolleri birleştirince: tek şifre, tek giriş, kurtarma doğrudan hesabın kendi kodunda. Devir korundu çünkü Türkiye'de yönetici yılda bir değişir — ama artık admin'in başkasını devretmesi değil, hesabın kendini yeni operatöre (geçici şifre + yeni ad) aktarmasıdır; şifre unutulursa `/recover` yedeği var. `role` kolonu CHECK-rewrite migration'ından kaçınmak için silinmeyip kalıntı bırakıldı |

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
- Koda açıklama yorumu eklemek (gerekçeyi bu dokümana yaz — §3)
- `showAlert.confirm` sonucunda `result.isConfirmed` beklemek — metod boolean döner (§11)
- `manager_id` filtresi olmadan manager verisi sorgulamak
- Handler içinde elle try/catch yazmak (`safeHandler` zarfı kullan — §5.2 madde 3)
- Metin alanını service'te tekrar trim'lemek — normalizasyon handler'da tek yerde yapılır (§9); şifreyi trim'lemek

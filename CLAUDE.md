# Mavikent Site Yönetimi Uygulaması — Proje Dokümantasyonu

> Gelecek hedefler ve planlanan özellikler için bkz. `ROADMAP.md`.

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

**Tür:** Electron + React masaüstü uygulaması  
**Hedef:** Apartman yöneticilerinin aidat, gelir/gider, daire/sakin ve raporlama işlemlerini tek uygulamadan yönetmesi

**Teknik Stack:** Electron v41, React v19, SQLite (better-sqlite3), Vite v8, SweetAlert2, jspdf + jspdf-autotable (PDF), electron-updater (GitHub Releases)

**Güncel Sürüm:** 1.1.0

---

## 2. Kod Yazma Kuralları

- **Dil:** UI metinleri Türkçe; kod ve yorumlar İngilizce
- **Stil:** Prettier
- **Naming:** değişkenler `camelCase`, React bileşenleri `PascalCase`

### Yapmadan Önce Sor

- Mimari değişiklikler (klasör yapısı, yeni dependency)
- 3+ dosya etkileyen refactor
- Veritabanı şeması değişikliği
- IPC endpoint ekleme/değiştirme
- 100+ satır silme

### Asla Kullanıcı Onayı Olmadan Yapma

- `git commit` — kullanıcı açıkça onay vermeden kesinlikle commit oluşturma
- `git push` — kullanıcı açıkça onay vermeden kesinlikle push yapma
- `gh release create` / `gh release edit` — kullanıcı açıkça izin vermeden
- `npm run dist` veya `npm run build` — kullanıcı açıkça "build et" demeden

### Asla Yapma

- `.env` oluşturma veya API anahtarı/şifre ekleme
- Kullanıcıya sormadan bağımlılık yükseltme

---

## 3. Klasör Yapısı

```
SiteManager/
├── database/
│   ├── schema/          # Tablo şemaları — NN_tablo.sql formatı, alfabetik sırayla yüklenir
│   ├── migrations/      # Mevcut tablolara ALTER — NNN_aciklama.sql formatı, bir kez çalışır
│   ├── db.js            # Bağlantı (WAL, pragma, integrity check)
│   ├── migrate.js       # runMigrations() — her başlangıçta main.js çağırır
│   └── seed.js          # İlk kurulumda admin hesabı oluşturma
│
├── electron/
│   ├── ipc/
│   │   ├── channels.js        # Tüm IPC kanal sabitleri — handler'lar ve preload buradan import eder
│   │   ├── index.js           # Handler kayıt merkezi
│   │   └── handlers/          # Her domain için ayrı handler dosyası (*.handlers.js)
│   ├── services/              # İş mantığı katmanı (*.service.js) — handler'lardan çağrılır
│   │   └── backup.service.js  # Yedek alma / geri yükleme — menu.js tarafından çağrılır
│   ├── windows/               # Yardımcı pencereler (guide.js vb.)
│   ├── main.js                # Electron ana döngüsü
│   ├── menu.js                # Uygulama menüsü (Dosya, Görünüm, Yardım, DevTools)
│   └── preload.js             # contextBridge — electronAPI'yi renderer'a açar
│
└── src/
    ├── components/      # Footer vb. paylaşılan bileşenler
    ├── router/          # ProtectedRoute (rol bazlı rota koruması)
    ├── hooks/           # useTheme, useCurrentUser
    ├── pages/           # Tüm sayfalar (lazy-load)
    ├── utils/           # alert.js (SweetAlert2), constants.js
    ├── App.jsx          # Rotalar (HashRouter)
    └── style.css        # Global stiller (light/dark tema CSS değişkenleri)
```

---

## 4. Kullanıcı Rolleri

| Rol       | Yetki                                  |
| --------- | -------------------------------------- |
| `admin`   | Tüm işlemler + manager hesabı yönetimi |
| `manager` | Aidat, gelir/gider, daire, raporlar    |

- Şifreler `bcryptjs` ile hash'lenerek saklanır
- Oturum: `sessionStorage` → `currentUser` anahtarı
- "Beni hatırla": 30 günlük session token
- Admin hesabı yalnızca bir adet olabilir; `seed.js` `is_active`'e bakmaksızın `role = 'admin'` varlığını kontrol eder
- `createManager`'da kullanıcı adı `/^[A-Za-z0-9_]{3,}$/` ile doğrulanır; timing attack koruması için sahte hash karşılaştırması yapılır
- Oturum kapatma tamamen client-side: `sessionStorage.clear()` + `user-session-changed` event dispatch (IPC yok)

---

## 5. Veritabanı Şeması

```sql
users                 (id, username, email, password_hash, role, is_active,
                       last_login, password_changed_at, created_at, updated_at)

apartments            (id, apartment_no UNIQUE NOCASE, floor,
                       type∈{0+1,1+1,2+1,3+1,4+1}, square_meters,
                       due_amount, is_active, manager_id→users.id,
                       created_at, updated_at)

residents             (id, full_name, phone, email, national_id,
                       resident_type∈{owner,tenant}, move_in_date, move_out_date,
                       is_active, notes,
                       apartment_id→apartments.id ON DELETE CASCADE,
                       created_at, updated_at)
                       -- Trigger: move_out_date set edilince is_active=0

dues                  (id, apartment_id→apartments.id, year, month,
                       due_amount CHECK(>0 AND <=50000),
                       paid_amount CHECK(>=0 AND <=due_amount),
                       status∈{unpaid,partial,paid},
                       created_at, updated_at)
                       UNIQUE(apartment_id, year, month)

due_payments          (id, due_id→dues.id, collected_by→users.id,
                       amount CHECK(>0 AND <=50000),
                       payment_method∈{cash,bank_transfer,card,other},
                       payment_date, note CHECK(len<=500), created_at)

payment_cancellations (id, payment_id→due_payments.id UNIQUE,
                       cancelled_by→users.id, cancelled_at, cancel_reason)
                       -- Immutable audit log: trigger ile UPDATE engellenir

incomes               (id, amount, date, description, category∈{dues,other},
                       is_cancelled, cancelled_at, cancel_reason,
                       manager_id→users.id, due_payment_id→due_payments.id UNIQUE,
                       cancelled_by→users.id, created_at, updated_at)

expenses              (id, amount, date, description,
                       category∈{maintenance,cleaning,utility,staff,other},
                       is_cancelled, cancelled_at, cancel_reason,
                       manager_id→users.id, cancelled_by→users.id,
                       created_at, updated_at)
```

### Schema Değişikliği Kuralı

`runMigrations()` her başlangıçta çalışır. Sıra:

1. `database/migrations/` — henüz uygulanmamış dosyalar ada göre sıralı çalışır, `migrations` tablosuna kaydedilir (tekrar çalışmaz). Fresh install'da "no such table" yakalanır, migration uygulandı sayılır.
2. `database/schema/` — `CREATE TABLE/TRIGGER IF NOT EXISTS` ile yüklenir. Fresh install'da tabloları bu aşama oluşturur; mevcut kurulumda no-op.

| Durum                               | Ne yapılır                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Yeni tablo                          | `database/schema/NN_tablo.sql` oluştur (ör. `09_yeni_tablo.sql`)                |
| Mevcut tabloya sütun/index/trigger  | `database/migrations/NNN_aciklama.sql` (ör. `005_aciklama.sql`) + ilgili `schema/` dosyasını da güncelle |
| Tablo silme veya yeniden adlandırma | Önce kullanıcıya sor                                                            |

---

## 6. Kritik İş Kuralları

1. **Aidat kaydı silinemez** — yalnızca düzenlenebilir.
2. **`getDuesForMonth`** — o ay için eksik aidat kayıtları `INSERT OR IGNORE` ile otomatik oluşturulur.
3. **`bulkUpdateDueAmount`** — yalnızca `apartments.due_amount`'ı günceller; mevcut `dues` kayıtlarına dokunmaz. Yeni ay oluşturulduğunda `getDuesForMonth` o anki `apartment.due_amount`'ı alır.
4. **Gelir/gider silinemez** — `cancelIncome` / `cancelExpense` ile `is_cancelled=1` yapılır.
5. **Ödeme iptali** — `due_payments` kaydı silinmez; `payment_cancellations`'a kayıt eklenir. Linked `incomes` kaydı otomatik iptal edilir. `paid_amount` doğrudan çıkarma değil, aktif ödemelerin `SUM`'ı ile yeniden hesaplanır.
6. **Aidat bağlantılı gelir** (`due_payment_id IS NOT NULL`) doğrudan iptal edilemez; yalnızca `cancelPayment` üzerinden otomatik iptal edilir.
7. **Soft-delete**: daire `is_active=0` — `recordPayment`'ta `AND is_active=1` kontrolü vardır.
8. **Sakinler**: `residents.is_active=1` olan aktif sakindir; bir dairenin birden fazla geçmiş sakini olabilir.
9. **Para tutarları** `REAL` saklanır, ekranda `₺` formatında gösterilir.
10. **Yedekleme**: `electron/services/backup.service.js` içinde `runBackup` / `runRestore` — `menu.js` tarafından çağrılır. IPC değil. Geri yüklemede integrity_check, `.bak` rollback ve `app.relaunch()` içerir.

---

## 7. Validasyon Katmanları

Her IPC çağrısı üç katmanda doğrulanır — değişiklik yaparken tüm katmanları kontrol et:

| Katman     | Dosya                                 | Ne kontrol eder                            |
| ---------- | ------------------------------------- | ------------------------------------------ |
| 1. Bridge  | `preload.js`                          | Tip kontrolü (typeof), null guard          |
| 2. Handler | `electron/ipc/handlers/*.handlers.js` | Alan varlığı, aralık, format (regex, enum) |
| 3. DB      | `database/schema/*.sql`               | CHECK constraint, NOT NULL, UNIQUE, FK     |

---

## 8. Uygulama Rotaları

| Rota               | Bileşen        | Rol     |
| ------------------ | -------------- | ------- |
| `/login`           | Login          | —       |
| `/admin`           | AdminDashboard | admin   |
| `/dashboard`       | Dashboard      | manager |
| `/add-apartment`   | AddApartment   | manager |
| `/apartments`      | Apartments     | manager |
| `/add-income`      | AddIncome      | manager |
| `/add-expense`     | AddExpense     | manager |
| `/transactions`    | Transactions   | manager |
| `/profile`         | Profile        | manager |
| `/reports`         | Reports        | manager |

---

## 9. electronAPI — IPC Endpoint Özeti

| Grup      | Metodlar                                                                         |
| --------- | -------------------------------------------------------------------------------- |
| Apartment | `addApartment`, `updateApartment`, `deleteApartment`, `bulkUpdateDueAmount`      |
| Auth      | `login`, `getManagers`, `createManager`, `updateManagerStatus`, `changePassword` |
| Dashboard | `getStats`                                                                       |
| Dues      | `getDuesForMonth`, `recordPayment`, `cancelPayment`, `getPaymentHistory`         |
| Financial | `addIncome`, `addExpense`, `getTransactions`, `cancelIncome`, `cancelExpense`    |
| Reports   | `getReportData`, `saveReportFile`                                                |
| System    | `getAppVersion`                                                                  |
| Events    | `onToggleTheme`, `onPrefillLogin` (main→renderer)                                |

---

## 10. Build & Dağıtım

```bash
npm run dev      # Vite + Electron eş zamanlı (concurrently + wait-on)
npm run start    # Sadece Electron
npm run build    # Vite production build
npm run dist     # Vite build + electron-builder (.exe NSIS installer)
npm run rebuild  # Native modülleri yeniden derle
```

- Uygulama verisi: `%APPDATA%/Mavikent Site Yönetimi/`
- Otomatik güncelleme: `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`)
- Tek instance kilidi: ikinci açılmaya çalışıldığında mevcut pencere öne gelir
- SQLite sıfırlama: `database.db`, `database.db-wal`, `database.db-shm` üçü birden silinmeli

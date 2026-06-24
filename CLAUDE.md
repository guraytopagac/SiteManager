# Mavikent Site Yönetimi Uygulaması — Proje Dokümantasyonu

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

**Teknik Stack:** Electron v41, React v19, SQLite (better-sqlite3), Vite v8, SweetAlert2, jspdf + jspdf-autotable (PDF), xlsx/SheetJS (Excel), electron-updater (GitHub Releases)

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

### Asla Yapma

- `.env` oluşturma veya API anahtarı/şifre ekleme
- Kullanıcıya sormadan bağımlılık yükseltme

---

## 3. Klasör Yapısı

```
SiteManager/
├── database/
│   ├── schema/              # Tablo şemaları (users, apartments, residents, dues, due_payments, incomes, expenses, payment_cancellations)
│   ├── db.js                # Bağlantı mantığı (WAL, pragma, integrity check)
│   ├── migrate.js           # Schema yükleyici + migration runner (runMigrations — her başlangıçta çağrılır)
│   └── seed.js              # İlk kurulumda admin hesabı oluşturma
│
├── electron/
│   ├── ipc/                 # IPC handler'ları (apartment, auth, dashboard, dues, financial, report, system)
│   │   ├── channels.js      # Tüm IPC kanal adları — handler'lar buradan import eder
│   │   └── index.js         # Handler kayıt merkezi
│   ├── services/            # İş mantığı (apartment, auth, dashboard, dues, financial, report)
│   ├── main.js              # Electron ana döngüsü + menü (menu.js'den buildMenu)
│   ├── menu.js              # Uygulama menüsü (Dosya, Yardım, DevTools)
│   └── preload.js           # electronAPI bridge (contextBridge, sandbox uyumlu inline CH)
│
└── src/
    ├── components/          # Footer, ProtectedRoute (rol bazlı rota koruması)
    ├── hooks/               # useTheme (tema yönetimi), useCurrentUser (oturum okuma)
    ├── pages/               # Login, Dashboard, AdminDashboard, Apartments, AddApartment,
    │                        #   AddIncome, AddExpense, Transactions, Profile, Reports
    ├── App.jsx              # Rotalar
    └── style.css            # Global stiller (light/dark tema CSS değişkenleri)
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

---

## 5. Veritabanı Şeması

```sql
users                  (id, username, email, password_hash, role, is_active,
                        failed_login_attempts, locked_until, last_login,
                        password_changed_at,
                        created_at, updated_at)
apartments             (id, apartment_no UNIQUE NOCASE, floor, type∈{1+1,2+1,3+1,4+1},
                        square_meters, due_amount, manager_id→users.id, created_at, updated_at)
residents              (id, full_name, phone, email, national_id, resident_type∈{owner,tenant},
                        move_in_date, move_out_date, is_active, notes,
                        apartment_id→apartments.id ON DELETE CASCADE, created_at, updated_at)
                        -- Trigger: updated_at otomatik (WHEN guard ile); move_out_date → is_active=0
dues                   (id, apartment_id→apartments.id, year, month, due_amount, due_date,
                        paid_amount, status∈{unpaid,partial,paid}, created_at, updated_at)
                        UNIQUE(apartment_id, year, month)
due_payments           (id, due_id→dues.id, amount, payment_method∈{cash,bank_transfer,card,other},
                        payment_date, receipt_path, note,
                        collected_by→users.id, created_at, updated_at)
payment_cancellations  (id, payment_id→due_payments.id UNIQUE, cancelled_by→users.id,
                        cancelled_at, cancel_reason)
                        -- Immutable audit log: trigger ile UPDATE engellenir
incomes                (id, amount, date, description, category∈{dues,other},
                        is_cancelled, cancelled_at, cancel_reason,
                        manager_id→users.id, due_payment_id→due_payments.id UNIQUE,
                        cancelled_by→users.id, created_at, updated_at)
                        -- due_payment_id: aidat ödemesi kaydedilince otomatik gelir eklenir (dues.service)
                        -- Ödeme iptal edilince linked gelir de otomatik iptal edilir
expenses               (id, amount, date, description,
                        category∈{maintenance,cleaning,utility,staff,other},
                        is_cancelled, cancelled_at, cancel_reason,
                        manager_id→users.id, cancelled_by→users.id, created_at, updated_at)
```

**Schema Değişikliği Kuralı:**

`runMigrations()` her başlangıçta `main.js` tarafından çağrılır. İki aşama:
1. `database/schema/` altındaki tüm SQL dosyaları `CREATE TABLE/TRIGGER IF NOT EXISTS` ile yüklenir (yeni kurulum için temel şema).
2. `database/migrations/` klasöründeki henüz uygulanmamış `.sql` dosyaları ada göre sıralı çalıştırılır ve `migrations` tablosuna kaydedilir (tekrar çalışmazlar).

| Durum | Ne yapılır |
| ----- | ---------- |
| **Yeni tablo ekleme** | `database/schema/` altına yeni `.sql` dosyası oluştur, `migrate.js` içindeki `SCHEMA_FILES` dizisine ekle. |
| **Mevcut tabloya sütun/index/trigger ekleme** | `database/migrations/` altına `NNN_aciklama.sql` dosyası oluştur (SQLite `ALTER TABLE ADD COLUMN` destekler; `IF NOT EXISTS` yoktur). |
| **Tablo silme veya yeniden adlandırma** | Önce kullanıcıya sor (bkz. §2). |

**Önemli Notlar:**
- `apartments` tablosundan `resident_name/phone/email` kaldırıldı → `residents` tablosuna taşındı
- `due_payments` tablosundan `is_cancelled/cancelled_at/cancel_reason` kaldırıldı → ayrı `payment_cancellations` tablosuna taşındı
- `payment_cancellations.payment_id` UNIQUE kısıtı: bir ödeme yalnızca bir kez iptal edilebilir
- `incomes` ve `expenses` soft-delete mantığıyla çalışır: `is_cancelled=1` + `cancel_reason` + `cancelled_by`
- `incomes.due_payment_id`: aidat ödemesi kaydedilince `dues.service` otomatik gelir ekler; ödeme iptalinde linked gelir de iptal edilir
- IPC kanal adları `electron/ipc/channels.js`'de sabitlenir; tüm handler'lar buradan import eder. `preload.js` `sandbox: true` nedeniyle inline CH kullanır (değerler channels.js ile senkronize tutulmalı)
- `logout` IPC kaldırıldı — oturum kapatma tamamen client-side: `sessionStorage.clear()` + `user-session-changed` event dispatch
- Admin hesabı yalnızca bir adet olabilir; `seed.js` `is_active` bakmaksızın `role = 'admin'` varlığını kontrol eder
- SQLite WAL modunda veritabanını sıfırlamak için `database.db`, `database.db-wal`, `database.db-shm` üçü birden silinmeli

---

## 6. Uygulama Rotaları

| Rota                 | Bileşen        | Rol          |
| -------------------- | -------------- | ------------ |
| `/`                  | Login          | —            |
| `/admin-dashboard`   | AdminDashboard | admin        |
| `/dashboard`         | Dashboard      | manager      |
| `/add-apartment`     | AddApartment   | manager      |
| `/apartments`        | Apartments     | manager      |
| `/add-income`        | AddIncome      | manager      |
| `/add-expense`       | AddExpense     | manager      |
| `/transactions`      | Transactions   | manager      |
| `/profile`           | Profile        | manager      |
| `/reports`           | Reports        | manager      |
| `/send-announcement` | —              | ❌ Henüz yok |

---

## 7. Temel İş Kuralları

1. Aidat kaydı silinemez, yalnızca düzenlenebilir.
2. `getDuesForMonth` çağrıldığında o ay için eksik aidat kayıtları otomatik oluşturulur (`INSERT OR IGNORE`).
3. Gelir/gider silinemez; `cancelIncome` / `cancelExpense` IPC ile iptal edilir (`is_cancelled=1`).
4. Ödeme iptali `due_payments` kaydını silmez; `payment_cancellations` tablosuna kayıt eklenir.
5. Sakin bilgileri `residents` tablosunda tutulur; bir dairenin birden fazla geçmiş sakini olabilir. `is_active=1` olan sakin aktiftir.
6. Para tutarları `REAL` olarak saklanır, ekranda `₺` formatında gösterilir.
7. Şifreler düz metin olarak **hiçbir zaman** saklanmaz.
8. Veritabanı yedeği: `backupDatabase` / `restoreDatabase` IPC çağrıları (Profil sayfası).

---

## 8. electronAPI — IPC Endpoint Özeti

| Grup        | Metod                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Apartment   | `addApartment`, `getApartments`, `updateApartment`, `deleteApartment`, `bulkUpdateDueAmount` |
| Auth        | `login`, `getManagers`, `createManager`, `updateManagerStatus`, `changePassword` |
| Dashboard   | `getStats`                                                            |
| Dues        | `getDuesForMonth`, `recordPayment`, `cancelPayment`, `getPaymentHistory` |
| Financial   | `addIncome`, `addExpense`, `getTransactions`, `cancelIncome`, `cancelExpense` |
| Reports     | `getReportData`, `saveReportFile`                                     |
| Database    | `backupDatabase`, `restoreDatabase`                                   |
| System      | `getAppVersion`                                                       |
| Events      | `onToggleTheme` (renderer listener)                                   |

---

## 9. Build & Dağıtım

```bash
npm run dev      # Vite + Electron eş zamanlı (concurrently + wait-on)
npm run start    # Sadece Electron
npm run build    # Vite production build
npm run dist     # Vite build + electron-builder (.exe NSIS installer)
npm run rebuild  # Native modülleri yeniden derle
```

- Uygulama verisi: `%APPDATA%/SiteManager/`
- Otomatik güncelleme: `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`)
- Yedek/geri yükleme: uygulama içi Profil sayfasından `backupDatabase` / `restoreDatabase`

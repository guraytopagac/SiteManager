# Mavikent Site Yönetimi Uygulaması — Proje Dokümantasyonu

## 0. Okunmayacak Dosya ve Klasörler

```
node_modules/
dist/
dist_electron/
database.db
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

- **Dil:** UI ve yorumlar Türkçe; kod İngilizce
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
│   ├── migrations/          # SQL migration dosyaları (001_, 002_, ...)
│   ├── schema/              # Tablo şemaları (users, apartments, dues, due_payments, incomes, expenses)
│   ├── db.js                # Bağlantı mantığı (WAL, pragma, integrity check)
│   ├── migrate.js           # Schema yükleyici + migration runner
│   └── seed.js              # İlk kurulumda admin hesabı oluşturma
│
├── electron/
│   ├── ipc/                 # IPC handler'ları (apartment, auth, dashboard, dues, financial, report, system)
│   │   └── index.js         # Handler kayıt merkezi
│   ├── services/            # İş mantığı (apartment, auth, dashboard, dues, financial, report)
│   ├── main.js              # Electron ana döngüsü ve menü
│   └── preload.js           # electronAPI bridge (contextBridge)
│
└── src/
    ├── components/          # Footer, ProtectedRoute (rol bazlı rota koruması)
    ├── hooks/               # useLoginLock (5 hatalı girişte 5 dk kilit)
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
users          (id, username, email, password_hash, role, is_active, last_login)
apartments     (id, apartment_no, floor, type, square_meters, due_amount,
                resident_name, resident_phone, resident_email, manager_id→users.id, created_at)
dues           (id, apartment_id→apartments.id, year, month, due_amount,
                paid_amount, status∈{unpaid,partial,paid}, created_at)
                UNIQUE(apartment_id, year, month)
due_payments   (id, due_id→dues.id, amount, payment_method∈{cash,bank_transfer,card,other},
                payment_date, receipt_path, note, collected_by→users.id,
                is_cancelled, cancelled_at, cancel_reason, created_at)
incomes        (id, amount, date, description, manager_id→users.id, created_at)
expenses       (id, amount, date, description, manager_id→users.id, created_at)
```

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
3. Gelir/gider silinemez; iptal işlemi yapılır.
4. Para tutarları `REAL` olarak saklanır, ekranda `₺` formatında gösterilir.
5. Şifreler düz metin olarak **hiçbir zaman** saklanmaz.
6. Veritabanı yedeği manuel (export/import `.db` dosyası).

---

## 8. Build & Dağıtım

```bash
npm run dev      # Vite + Electron eş zamanlı (concurrently + wait-on)
npm run start    # Sadece Electron
npm run build    # Vite production build
npm run dist     # Vite build + electron-builder (.exe NSIS installer)
npm run rebuild  # Native modülleri yeniden derle
```

- Uygulama verisi: `%APPDATA%/SiteManager/`
- Otomatik güncelleme: `electron-updater` → GitHub Releases (`guraytopagac/SiteManager`)

# Mavikent Site Yönetimi Uygulaması — Proje Dokümantasyonu

## 0. Claude İçin Dosya Okuma Kısıtlamaları

> Bu bölüm Claude Code'a hangi dosya ve klasörleri **okumayacağını** söyler.
> Aşağıdaki yolları asla okuma, içeriklerini analiz etme, listeleyerek gezme.

### Okunmayacak Klasörler ve Dosyalar

```
# Bağımlılıklar — npm paketleri, binary'ler, kaynak koduyla ilgisi yok
node_modules/

# Derleme çıktıları — Vite'ın ürettiği, elle yazılmış kod değil
dist/
dist_electron/

# SQLite veritabanı — binary format, okunabilir değil; şema db.js'te
database.db

# Bağımlılık kilit dosyası — 10.000+ satır, otomatik üretilir
package-lock.json

# Electron önbelleği — indirilen binary'ler, proje koduyla ilgisi yok
.cache/
```

### Neden Bu Kurallar Var

| Yol                      | Neden hariç                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `node_modules/`          | Binlerce dosya, tüm context'i tüketir; paket API'si `package.json`'dan okunur |
| `dist/` `dist_electron/` | `npm run build` çıktısı; `src/` ve `electron/` bunların kaynağı               |
| `database.db`            | Binary SQLite dosyası; şema zaten `database/db.js`'te okunabilir formatta     |
| `package-lock.json`      | Otomatik üretilir, 10.000+ satır; bağımlılık bilgisi `package.json`'da yeter  |
| `.cache/`                | Electron ve Vite önbelleği, geçici dosyalar                                   |

---

## 1. Proje Genel Bakış

**Proje Adı:** Mavikent Site Yönetimi Uygulaması  
**Uygulama Türü:** Masaüstü Uygulaması  
**Hedef Kullanıcı:** Apartman Yöneticileri  
**Amaç:** Apartman yöneticilerinin aidat takibi, gelir-gider yönetimi, daire/sakin bilgileri, borç-alacak durumu ve raporlama işlemlerini tek bir uygulama üzerinden kolayca yönetebilmesi.

---

## 2. Teknik Stack

| Katman           | Teknoloji   |
| ---------------- | ----------- |
| Masaüstü Çerçeve | Electron.js |
| Arayüz           | React       |
| Stil             | CSS         |
| Veritabanı       | SQLite      |
| Paket Yöneticisi | npm         |
| Build Aracı      | Vite        |
| UI Bildirimleri  | SweetAlert2 |

---

## 3. İŞ AKIŞI VE KİŞİSEL KURALLAR

### 3.1 Kod Yazarken Uyulacak Kurallar

- **Dil:**
  - Türkçe sadece kullanıcı arayüzünde gösterilecek kısımlar ve yorum satırlarında kullanılacak.
  - Kod tarafı tamamen İngilizce olacak.
- **Stil:** Prettier
- **Naming:**
  - Değişkenler: camelCase (const userName)
  - React bileşenleri: PascalCase

### 3.2 Yapılmadan Önce Sor

Claude, aşağıdakileri yapmadan ÖNCE bana sor:

- Mimariye dokunacak değişiklikler (klasör yapısı, yeni dependency)
- 3+ dosyada değişiklik gerektiren refactor
- Veritabanı şemasında değişiklik
- API endpoint'leri ekleme/değiştirme
- 100+ satırdan fazla kod silme

### 3.3 Asla Yapma

Claude, hiçbir zaman:

- .env dosyasını oluşturma veya örnekleyerek ortaya çıkarma
- API anahtarları, şifreler veya gizli bilgiler ekleme
- Kullanıcıya sormadan bağımlılık yükseltme

---

## 4. Proje Klasör Yapısı

```
SiteManager/
├── database/                           # Veritabanı bağlantısı ve konfigürasyon dosyaları
│   ├── migrations/                     # SQL migration dosyaları (001_, 002_, ...)
│   │   └── 001_initial_schema.sql      # Baseline migration kaydı
│   ├── schema/                         # Tablo şema dosyaları (migrate.js tarafından yüklenir)
│   │   ├── apartments.sql
│   │   ├── due_payments.sql
│   │   ├── dues.sql
│   │   ├── expenses.sql
│   │   ├── incomes.sql
│   │   └── users.sql
│   ├── db.js                           # Veritabanı bağlantı mantığı (WAL, pragma, integrity check)
│   ├── migrate.js                      # Schema yükleyici ve migration runner
│   └── seed.js                         # İlk kurulumda admin hesabı oluşturma
│
├── electron/                           # Electron.js ana süreç (main process) dosyaları
│   ├── ipc/                            # Renderer ve Main süreçleri arası iletişim (IPC) handlerları
│   │   ├── apartment.handlers.js
│   │   ├── auth.handlers.js
│   │   ├── dashboard.handlers.js
│   │   ├── dues.handlers.js
│   │   ├── financial.handlers.js
│   │   ├── report.handlers.js
│   │   ├── system.handlers.js
│   │   └── index.js                    # IPC handler'ların ana merkezi
│   │
│   ├── services/                       # Veritabanı ile doğrudan konuşan iş mantığı katmanı
│   │   ├── apartment.service.js
│   │   ├── auth.service.js
│   │   ├── dashboard.service.js
│   │   └── financial.service.js
│   │
│   ├── main.js                         # Electron ana uygulama döngüsü ve menü tanımlamaları
│   └── preload.js                      # Güvenli bridge ve electronAPI tanımlamaları
│
├── node_modules/                       # Proje bağımlılıkları
│
├── src/                                # React frontend kaynak kodları
│   ├── assets/                         # Görseller, ikonlar ve statik dosyalar
│   │   ├── icon.ico
│   │   └── logo.png
│   │
│   ├── components/                     # Yeniden kullanılabilir UI ve layout bileşenleri
│   │   ├── Footer.css
│   │   ├── Footer.jsx
│   │   └── ProtectedRoute.jsx          # Rol bazlı rota koruma bileşeni
│   │
│   ├── hooks/                          # Özel React hook'ları
│   │   └── useLoginLock.js
│   │
│   ├── pages/                          # Sayfa bazlı bileşenler
│   │   ├── AddApartment/               # Daire ekleme sayfası
│   │   ├── AddExpense/                 # Gider ekleme sayfası
│   │   ├── AddIncome/                  # Gelir ekleme sayfası
│   │   ├── AdminDashboard/             # Admin yönetim paneli (manager hesap yönetimi)
│   │   ├── Apartments/                 # Daireler listeleme sayfası
│   │   ├── Dashboard/                  # Manager ana ekranı (aidat, kasa, istatistikler)
│   │   ├── Login/                      # Giriş yapma ekranı
│   │   ├── Profile/                    # Kullanıcı profili ve şifre değiştirme
│   │   ├── Reports/                    # Rapor görüntüleme ve PDF export
│   │   └── Transactions/               # Gelir/gider işlem geçmişi
│   │
│   ├── App.jsx                         # Ana uygulama rotaları ve bileşen yapısı
│   ├── main.jsx                        # React DOM giriş noktası
│   └── style.css                       # Global stiller (light/dark tema CSS değişkenleri dahil)
│
├── .gitattributes                      # Git dosya öznitelikleri
├── .gitignore                          # Git takip edilmeyecek dosyalar listesi
├── CLAUDE.md                           # Proje notları ve dokümantasyon
├── database.db                         # SQLite veritabanı dosyası (geliştirme)
├── eslint.config.js                    # Kod standartları konfigürasyonu
├── index.html                          # Uygulamanın temel HTML şablonu
├── package-lock.json                   # Bağımlılık sürüm kilidi
├── package.json                        # Proje meta verileri ve script'ler
└── vite.config.js                      # Vite derleyici ayarları
```

### 4.1 Klasörlerin Amacı:

- `src/` → Kullanıcı Arayüzü (Frontend)
- `electron/` → Arka Plan Süreçleri (Backend)
- `database/` → Veri Depolama

---

## 5. Kullanıcı Yönetimi

### 5.1 Kullanıcı Rolleri

| Rol       | Yetki                                             |
| --------- | ------------------------------------------------- |
| `admin`   | Tüm işlemler + diğer yönetici hesaplarını yönetme |
| `manager` | Aidat, gelir/gider, daire, raporlar, duyurular    |

### 5.2 Kimlik Doğrulama

- Kullanıcı adı + şifre ile giriş
- Şifreler **bcryptjs** ile hashlenerek SQLite'ta saklanır
- Oturum bilgisi `sessionStorage`'da `currentUser` anahtarıyla tutulur
- "Beni hatırla" seçeneği (session token, 30 gün geçerli)
- Başarısız giriş denemesi kilitleme: 5 hatalı girişte 5 dakika bekleme (`useLoginLock` hook)

---

## 6. Veritabanı Şeması (Mevcut)

Şemalar `database/schema/` klasöründe ayrı `.sql` dosyaları olarak tutulur; `migrate.js` bunları yükler.

```sql
-- Kullanıcı tablosu
users (id, username, email, password_hash, role, is_active, last_login)

-- Daire tablosu (sakin bilgileri dahil)
apartments (id, apartment_no, floor, type, square_meters, due_amount,
            resident_name, resident_phone, resident_email,
            manager_id → users.id, created_at)

-- Aidat tablosu (ay bazlı borç takibi)
dues (id, apartment_id → apartments.id, year, month, due_amount,
      paid_amount, status ∈ {unpaid, partial, paid}, created_at)
      UNIQUE(apartment_id, year, month)

-- Aidat ödeme kalemleri (iptal desteği ile)
due_payments (id, due_id → dues.id, amount, payment_method ∈ {cash, bank_transfer, card, other},
              payment_date, receipt_path, note, collected_by → users.id,
              is_cancelled, cancelled_at, cancel_reason, created_at)

-- Gelir tablosu
incomes (id, amount, date, description, manager_id → users.id, created_at)

-- Gider tablosu
expenses (id, amount, date, description, manager_id → users.id, created_at)
```

---

## 7. electronAPI (preload.js — Mevcut)

### Daire İşlemleri
| Metod                | IPC Kanalı              | Açıklama                          |
| -------------------- | ----------------------- | --------------------------------- |
| `addApartment`       | `add-apartment`         | Yeni daire ekle                   |
| `getApartments`      | `get-apartments`        | Daire listesi getir               |
| `updateApartment`    | `update-apartment`      | Daire bilgisi güncelle            |
| `deleteApartment`    | `delete-apartment`      | Daire sil                         |
| `bulkUpdateDueAmount`| `bulk-update-due-amount`| Tüm dairelerin aidat tutarını güncelle |

### Kullanıcı / Auth
| Metod                | IPC Kanalı              | Açıklama                          |
| -------------------- | ----------------------- | --------------------------------- |
| `login`              | `login`                 | Kullanıcı girişi                  |
| `getManagers`        | `get-managers`          | Manager listesi (admin)           |
| `createManager`      | `create-manager`        | Yeni manager oluştur (admin)      |
| `updateManagerStatus`| `update-manager-status` | Manager aktif/pasif yap (admin)   |
| `changePassword`     | `change-password`       | Şifre değiştir                    |

### Dashboard
| Metod      | IPC Kanalı  | Açıklama                 |
| ---------- | ----------- | ------------------------ |
| `getStats` | `get-stats` | Dashboard istatistikleri |

### Aidat
| Metod              | IPC Kanalı           | Açıklama                        |
| ------------------ | -------------------- | ------------------------------- |
| `getDuesForMonth`  | `get-dues-for-month` | Aylık aidat listesi             |
| `recordPayment`    | `record-payment`     | Ödeme kaydet                    |
| `cancelPayment`    | `cancel-payment`     | Ödemeyi iptal et                |
| `getPaymentHistory`| `get-payment-history`| Aidat ödeme geçmişi             |

### Finansal
| Metod            | IPC Kanalı        | Açıklama              |
| ---------------- | ----------------- | --------------------- |
| `addIncome`      | `add-income`      | Gelir kaydı ekle      |
| `addExpense`     | `add-expense`     | Gider kaydı ekle      |
| `getTransactions`| `get-transactions`| Gelir/gider listesi   |

### Veritabanı
| Metod             | IPC Kanalı         | Açıklama          |
| ----------------- | ------------------ | ----------------- |
| `backupDatabase`  | `backup-database`  | Veritabanı yedekle |
| `restoreDatabase` | `restore-database` | Yedekten geri yükle|

### Raporlar
| Metod           | IPC Kanalı        | Açıklama                  |
| --------------- | ----------------- | ------------------------- |
| `getReportData` | `get-report-data` | Rapor verisi getir        |
| `saveReportFile`| `save-report-file`| Raporu diske kaydet       |

### Events
| Metod           | IPC Kanalı     | Açıklama                    |
| --------------- | -------------- | --------------------------- |
| `onToggleTheme` | `toggle-theme` | Light/dark tema değişikliği |

---

## 8. Uygulama Rotaları (Mevcut)

Rotalar `ProtectedRoute` bileşeniyle rol bazlı korunur.

| Rota                 | Bileşen        | Rol       | Durum         |
| -------------------- | -------------- | --------- | ------------- |
| `/`                  | Login          | —         | ✅ Tamamlandı |
| `/admin-dashboard`   | AdminDashboard | admin     | ✅ Tamamlandı |
| `/dashboard`         | Dashboard      | manager   | ✅ Tamamlandı |
| `/add-apartment`     | AddApartment   | manager   | ✅ Tamamlandı |
| `/apartments`        | Apartments     | manager   | ✅ Tamamlandı |
| `/add-income`        | AddIncome      | manager   | ✅ Tamamlandı |
| `/add-expense`       | AddExpense     | manager   | ✅ Tamamlandı |
| `/transactions`      | Transactions   | manager   | ✅ Tamamlandı |
| `/profile`           | Profile        | manager   | ✅ Tamamlandı |
| `/reports`           | Reports        | manager   | ✅ Tamamlandı |
| `/send-announcement` | —              | —         | ❌ Henüz yok  |

> **Not:** `/register` rotası kaldırıldı; manager hesapları artık AdminDashboard üzerinden admin tarafından oluşturuluyor.

---

## 9. Dashboard (Mevcut Durum)

3 istatistik kartı:

- **Kasa:** Toplam gelir - toplam gider
- **Tahsilat:** Aidat tahsilat yüzdesi (%)
- **Gecikme:** Gecikmiş aidat toplam tutarı (₺)

Hızlı erişim butonları (4 kategori grubu):

- Daire İşlemleri → Yeni Daire Ekle, Mevcut Daireleri Görüntüle
- Finansal İşlemler → Gelir Ekle, Gider Ekle
- Çeşitli → Duyuru Gönder, PDF Raporu

---

## 10. Electron Menüsü

| Menü   | Öğe                  | Kısayol      |
| ------ | -------------------- | ------------ |
| Dosya  | Tema Değiştir        | Ctrl+Shift+T |
| Dosya  | Yenile               | Ctrl+R       |
| Dosya  | Çıkış                | Ctrl+Q       |
| Yardım | Hakkında             | —            |
| (Dev)  | Geliştirici Araçları | F12          |

---

## 11. Modüller — Durum

### 11.1 Aidat Takibi ✅ (Tamamlandı)

- `dues` tablosu: ay bazlı borç kaydı (UNIQUE apartment+year+month)
- `due_payments` tablosu: ödeme kalemleri, iptal desteği
- IPC: `getDuesForMonth`, `recordPayment`, `cancelPayment`, `getPaymentHistory`

### 11.2 Daire ve Sakin Yönetimi ✅ (Tamamlandı)

- Sakin bilgileri (resident_name, phone, email) apartments tablosunda
- Daire ekleme, güncelleme, silme, toplu aidat güncelleme

### 11.3 Finansal İşlemler ✅ (Tamamlandı)

- Gelir/gider ekleme ve listeleme (`Transactions` sayfası)
- Veritabanı yedekleme ve geri yükleme

### 11.4 Raporlar ✅ (Kısmen Tamamlandı)

- `Reports` sayfası mevcut
- `getReportData` ve `saveReportFile` IPC'leri tanımlı
- PDF export implementasyonu durumu belirsiz (servis katmanı kontrol edilmeli)

### 11.5 Admin Paneli ✅ (Tamamlandı)

- `AdminDashboard`: manager hesabı oluşturma, aktif/pasif yapma
- İlk kurulumda otomatik admin seed (`database/seed.js`)

### 11.6 Bildirim / Duyuru Yönetimi ❌ (Henüz yok)

- Uygulama içi duyuru gönderme
- SMS/e-posta entegrasyonu

---

## 12. Temel İş Kuralları

1. Aidat kaydı silinemez, yalnızca düzenlenebilir.
2. Ay başında sistem otomatik olarak tüm aktif daireler için aidat borcu oluşturur.
3. Gider ve gelir kayıtları silinemez; yanlış kayıt için "iptal" işlemi yapılır (ters kayıt).
4. Tüm para tutarları `REAL` olarak saklanır, ekranda `₺` formatında gösterilir.
5. Kullanıcı şifreleri düz metin olarak **hiçbir zaman** saklanmaz.
6. Veritabanı yedeklemesi manuel olarak yönetici tarafından yapılır (export/import).

---

## 13. Dağıtım (Build & Release)

- `electron-builder` ile Windows `.exe` installer üretilir
- NSIS installer formatı (kurulum sihirbazı)
- Uygulama verisi: `%APPDATA%/SiteManager/` dizininde saklanır
- SQLite dosyası: `%APPDATA%/SiteManager/database.db` (production), `./database.db` (development)
- Yedek dosyaları: kullanıcının seçtiği dizine `.db` olarak aktarılır

**Build Scriptleri:**

```bash
npm run dev      # Vite dev server
npm run start    # Electron başlat
npm run build    # Vite production build
npm run dist     # Vite build + electron-builder installer
```

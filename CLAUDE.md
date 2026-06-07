# Mavikent Site Yönetimi Uygulaması — Proje Dokümantasyonu

## 1. Proje Genel Bakış

**Proje Adı:** Mavikent Site Yönetimi Uygulaması  
**Uygulama Türü:** Masaüstü Uygulaması  
**Hedef Kullanıcı:** Apartman Yöneticileri  
**Amaç:** Apartman yöneticilerinin aidat takibi, gelir-gider yönetimi, daire/sakin bilgileri, borç-alacak durumu ve raporlama işlemlerini tek bir uygulama üzerinden kolayca yönetebilmesi.

---

## 2. Teknik Stack

| Katman           | Teknoloji      |
| ---------------- | -------------- |
| Masaüstü Çerçeve | Electron.js    |
| Arayüz           | React          |
| Stil             | CSS            |
| Veritabanı       | SQLite         |
| Paket Yöneticisi | npm            |
| Build Aracı      | Vite           |
| UI Bildirimleri  | SweetAlert2    |

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
│   └── db.js                           # Veritabanı bağlantı mantığı ve tablo oluşturma
│
├── electron/                           # Electron.js ana süreç (main process) dosyaları
│   ├── ipc/                            # Renderer ve Main süreçleri arası iletişim (IPC) handlerları
│   │   ├── apartment.handlers.js
│   │   ├── auth.handlers.js
│   │   ├── dashboard.handlers.js
│   │   ├── financial.handlers.js
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
│   │   └── Footer.jsx
│   │
│   ├── hooks/                          # Özel React hook'ları
│   │   └── useLoginLock.js
│   │
│   ├── pages/                          # Sayfa bazlı bileşenler
│   │   ├── AddApartment/               # Daire ekleme sayfası
│   │   │   ├── AddApartment.jsx
│   │   │   └── AddApartment.css
│   │   │
│   │   ├── AddExpense/                 # Gider ekleme sayfası
│   │   │   ├── AddExpense.jsx
│   │   │   └── AddExpense.css
│   │   │
│   │   ├── AddIncome/                  # Gelir ekleme sayfası
│   │   │   ├── AddIncome.jsx
│   │   │   └── AddIncome.css
│   │   │
│   │   ├── Apartments/                 # Daireler listeleme sayfası
│   │   │   ├── Apartments.jsx
│   │   │   └── Apartments.css
│   │   │
│   │   ├── Dashboard/                  # Ana özet ve işlem ekranı
│   │   │   ├── Dashboard.jsx
│   │   │   └── Dashboard.css
│   │   │
│   │   ├── Login/                      # Giriş yapma ekranı
│   │   │   ├── Login.jsx
│   │   │   └── Login.css
│   │   │
│   │   └── Register/                   # Kayıt olma ekranı
│   │       ├── Register.jsx
│   │       └── Register.css
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

```sql
-- Kullanıcı tablosu
users (id, username, email, password_hash, role, is_active, last_login)

-- Daire tablosu
apartments (id, apartment_no, floor, type, square_meters, due_amount, manager_id → users.id)

-- Gelir tablosu
incomes (id, amount, date, description, manager_id → users.id)

-- Gider tablosu
expenses (id, amount, date, description, manager_id → users.id)
```

> **Not:** Aidat takibi için ayrı bir tablo henüz oluşturulmamıştır.

---

## 7. electronAPI (preload.js — Mevcut)

| Metod              | IPC Kanalı       | Açıklama                        |
| ------------------ | ---------------- | ------------------------------- |
| `onToggleTheme`    | `toggle-theme`   | Light/dark tema değişikliği     |
| `login`            | `login`          | Kullanıcı girişi                |
| `register`         | `register`       | Yeni kullanıcı kaydı            |
| `getStats`         | `get-stats`      | Dashboard istatistikleri        |
| `addApartment`     | `add-apartment`  | Yeni daire ekle                 |
| `getApartments`    | `get-apartments` | Daire listesi getir             |
| `addIncome`        | `add-income`     | Gelir kaydı ekle                |

> **Not:** `addExpense` IPC handler'ı henüz eklenmemiştir.

---

## 8. Uygulama Rotaları (Mevcut)

| Rota              | Bileşen        | Durum      |
| ----------------- | -------------- | ---------- |
| `/`               | Login          | ✅ Tamamlandı |
| `/register`       | Register       | ✅ Tamamlandı |
| `/dashboard`      | Dashboard      | ✅ Tamamlandı |
| `/add-apartment`  | AddApartment   | ✅ Tamamlandı |
| `/apartments`     | Apartments     | ✅ Tamamlandı |
| `/add-income`     | AddIncome      | ✅ Tamamlandı |
| `/add-expense`    | AddExpense     | 🔧 UI var, IPC eksik |
| `/send-announcement` | —           | ❌ Henüz yok |
| `/reports`        | —              | ❌ Henüz yok |

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

| Menü     | Öğe              | Kısayol          |
| -------- | ---------------- | ---------------- |
| Dosya    | Tema Değiştir    | Ctrl+Shift+T     |
| Dosya    | Yenile           | Ctrl+R           |
| Dosya    | Çıkış            | Ctrl+Q           |
| Yardım   | Hakkında         | —                |
| (Dev)    | Geliştirici Araçları | F12          |

---

## 11. Modüller — Planlanan / Eksik

### 11.1 Aidat Takibi ❌ (Henüz yok)
- Aylık otomatik borç kaydı oluşturma
- Ödeme işaretleme
- Gecikmiş aidat tespiti

### 11.2 Borç / Alacak Takibi ❌ (Henüz yok)
- Sakin bazında borç hesaplama
- Gecikme günü hesaplama

### 11.3 Raporlar ve PDF Export ❌ (Henüz yok)
- Aylık/yıllık özet
- Daire bazlı rapor
- PDF dışa aktarma

### 11.4 Bildirim / Duyuru Yönetimi ❌ (Henüz yok)
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

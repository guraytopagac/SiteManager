# Mavikent Site Yönetimi — Geliştirme Planı

Bu dosya gelecek hedefleri, planlanan özellikleri ve teknik iyileştirmeleri içerir.
Mevcut durum ve mimari için bkz. `CLAUDE.md`.

> **Kural:** Bir görev tamamlandığında ilgili bölüm bu dosyadan silinir.

---

## Özellik Planları

### Aidat Hatırlatma

Ay sonu yaklaşınca ödenmemiş daireler için uygulama içi özet/uyarı.

- Dashboard'da "Bu ay ödenmemiş: X daire" kartı
- Ay sonu (ör. son 5 gün) yaklaşınca vurgulu gösterim
- Detay: daire no, sakin adı, kalan tutar listesi
- Eklenecek dosyalar: `electron/modules/dashboard/service.js` sorgu genişletmesi, `Dashboard.jsx` UI

---

### Sakin Geçmişi

Bir dairenin tüm geçmiş sakinlerini listeleyen ekran. Veri `residents` tablosunda zaten mevcut (`is_active=0` kayıtlar), sadece UI eksik.

- `Apartments.jsx` içinde daire detay modalına "Geçmiş Sakinler" sekmesi
- Sütunlar: ad soyad, giriş tarihi, çıkış tarihi, sakin tipi
- Yeni IPC endpoint gerekmeyebilir — mevcut apartman verisiyle veya yeni `getResidentHistory(apartmentId)` servisiyle

---

### Gelişmiş Filtreler (Transactions)

`Transactions.jsx` sayfasına filtre paneli:

- Tarih aralığı (başlangıç – bitiş)
- Kategori çoklu seçim
- Tür: gelir / gider / hepsi
- Durum: aktif / iptal / hepsi
- `getTransactions` IPC parametreleri genişletilecek; servis katmanında dinamik WHERE oluşturma

---

### Dashboard Geliştirme

Son 6 aya ait gelir/gider trend grafiği.

- Kütüphane: mevcut stack'e en az bağımlılıkla `recharts` veya saf SVG
- Veri: `electron/modules/financial/service.js` içine yeni `getMonthlyTrend(managerId, monthCount)` metodu
- Gösterim: çubuk veya çizgi grafik, ay etiketleri Türkçe (Oca, Şub…)
- Yeni IPC endpoint gerekir — kullanıcıya sor

---

## Altyapı Planları

### PDF Makbuz / Fatura

Ödeme kaydedince yazdırılabilir makbuz üretme. `jspdf` zaten bağımlılıkta mevcut.

- Makbuz içeriği: daire no, sakin adı, tutar, ödeme yöntemi, tarih, tahsil eden
- `recordPayment` sonrası isteğe bağlı "Makbuz Yazdır" butonu
- `saveReportFile` IPC yeniden kullanılabilir veya ayrı endpoint

---

### CSV / Excel Dışa Aktarım

Rapor ve işlem verilerini Excel'e aktarma.

- `xlsx` veya `csv` çıktı (bağımlılık kararı kullanıcıya sor)
- Transactions ve Reports sayfalarına "Dışa Aktar" butonu
- Electron tarafında dosya kaydetme diyaloğu (`dialog.showSaveDialog`)

---

### Otomatik Yedekleme Zamanlayıcısı

Her gün belirlenen saatte `%APPDATA%/Mavikent.../backups/` klasörüne otomatik yedek.

- Ayar: yedekleme saati, saklanacak yedek sayısı (ör. son 7 gün)
- `main.js` içinde `setInterval` veya `node-cron` (bağımlılık kararı kullanıcıya sor)
- Mevcut `db.backup()` API'si kullanılır
- Profil veya Ayarlar sayfasında yapılandırma UI

---

### Bulut Yedekleme

Otomatik yedeği Google Drive veya Dropbox'a gönderme.

- OAuth akışı Electron'da `shell.openExternal` + lokal callback sunucu ile yönetilir
- Alternatif: kullanıcı bir klasör seçer, uygulama oraya yedekler (senkron işi kullanıcıya bırakır — daha basit)
- Karar: OAuth entegrasyonu mu, klasör seçimi mi? Kullanıcıya sor

---

### Çok Bina Desteği

Tek yöneticinin birden fazla binayı yönetmesi.

- Mevcut `manager_id` bazlı mimari buna hazır ama UI tek bina varsayımıyla çalışıyor
- Gerekli değişiklikler:
  - Bina seçici (sidebar veya üst menü)
  - `currentBuilding` oturum state'i
  - Tüm IPC çağrılarına `buildingId` parametresi veya mevcut `managerId` mantığının yeterli olup olmadığının analizi
- **Mimari karar gerektirir — başlamadan önce kullanıcıyla detaylı konuş**

---

## Teknik İyileştirmeler

- `getPaymentHistory` handler'ına `managerId` ile yetki doğrulaması eklenmesi (şu an sadece `dueId` alıyor)
- Transactions sayfası büyüdükçe sayfalama (pagination) gerekebilir
- ESLint `no-unused-vars` kuralını `warn`'dan `error`'a yükseltmek

---

## Kararı Verilmemiş Konular

| Konu                       | Seçenekler                           |
| -------------------------- | ------------------------------------ |
| Trend grafiği kütüphanesi  | `recharts` vs saf SVG                |
| Excel dışa aktarım         | `xlsx` paketi vs CSV (bağımlılıksız) |
| Otomatik yedek zamanlayıcı | `setInterval` vs `node-cron`         |
| Bulut yedekleme yöntemi    | OAuth entegrasyonu vs klasör seçimi  |

-- Mevcut şemanın migration kaydı.
-- Bu tablolar db.js içinde zaten CREATE TABLE IF NOT EXISTS ile oluşturuluyor;
-- bu dosya yalnızca migration geçmişini kayıt altına almak için eklendi.
-- İlerideki şema değişiklikleri 002_, 003_... dosyalarına yazılmalıdır.

SELECT 1; -- no-op: tablolar db.js tarafından zaten oluşturulmuş

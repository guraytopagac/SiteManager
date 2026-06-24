const db = require("../../database/db");

const COLUMN_LABELS = {
  apartment_no: "Daire numarası",
  floor: "Kat",
  type: "Daire tipi",
  square_meters: "Metrekare",
  due_amount: "Aidat tutarı",
  phone: "Telefon numarası",
  email: "E-posta adresi",
  national_id: "TC Kimlik No",
  move_in_date: "Giriş tarihi",
  move_out_date: "Çıkış tarihi",
  full_name: "Ad Soyad",
};

function resolveDbError(err, context = "İşlem") {
  const msg = err.message ?? "";

  if (msg.includes("UNIQUE constraint failed")) {
    const col = msg.split("UNIQUE constraint failed:")[1]?.split(".")[1]?.trim();
    const label = COLUMN_LABELS[col] ?? col ?? "Alan";
    return `${label} zaten kullanılıyor.`;
  }

  if (msg.includes("CHECK constraint failed")) {
    const col = msg.split("CHECK constraint failed:")[1]?.trim().split(/\s/)[0];
    const label = COLUMN_LABELS[col];
    if (col === "phone") return "Telefon numarası geçersiz. En az 10 karakter, yalnızca rakam ve +()- içerebilir.";
    if (col === "national_id") return "TC Kimlik No 11 haneli rakamdan oluşmalıdır.";
    if (col === "email") return "Geçersiz e-posta adresi.";
    if (col === "due_amount") return "Aidat tutarı 0'dan büyük ve 50.000₺'den küçük olmalıdır.";
    if (col === "floor") return "Kat -2 ile 99 arasında olmalıdır.";
    if (col === "square_meters") return "Metrekare 0'dan büyük ve 1000'den küçük olmalıdır.";
    if (label) return `${label} geçersiz bir değer içeriyor.`;
    return `Girilen bilgilerden biri geçersiz. Lütfen kontrol edin.`;
  }

  if (msg.includes("NOT NULL constraint failed")) {
    const col = msg.split("NOT NULL constraint failed:")[1]?.split(".")[1]?.trim();
    const label = COLUMN_LABELS[col] ?? col ?? "Zorunlu alan";
    return `${label} boş bırakılamaz.`;
  }

  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "İlişkili kayıt bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
  }

  return `${context} sırasında beklenmeyen bir hata oluştu.`;
}

function addApartment(data) {
  try {
    const addTx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(data.apartment_no, data.floor, data.type, data.square_meters, data.due_amount, data.manager_id);

      if (data.resident_name?.trim()) {
        if (!data.resident_type) throw new Error("resident_type_required");
        db.prepare(
          `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          result.lastInsertRowid,
          data.resident_name.trim(),
          data.resident_phone || null,
          data.resident_email || null,
          data.resident_national_id || null,
          data.resident_type,
          data.resident_move_in_date || null,
          data.resident_move_out_date || null,
          data.resident_notes || null,
        );
      }
    });

    addTx();
    return { success: true, message: "Daire eklendi." };
  } catch (err) {
    if (err.message === "resident_type_required") return { success: false, message: "Sakin türü seçilmelidir." };
    return { success: false, message: resolveDbError(err, "Daire ekleme") };
  }
}


function updateApartment(id, data) {
  try {
    const updateTx = db.transaction(() => {
      const result = db
        .prepare(
          `UPDATE apartments
           SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?, updated_at = datetime('now')
           WHERE id = ? AND manager_id = ?`,
        )
        .run(data.apartment_no, data.floor, data.type, data.square_meters, data.due_amount, id, data.manager_id);

      if (result.changes === 0) throw new Error("not_found");

      const existing = db.prepare(`SELECT id FROM residents WHERE apartment_id = ? AND is_active = 1`).get(id);

      if (data.resident_name?.trim()) {
        if (existing) {
          db.prepare(
            `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
             move_in_date = ?, move_out_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
          ).run(
            data.resident_name.trim(),
            data.resident_phone || null,
            data.resident_email || null,
            data.resident_national_id || null,
            data.resident_type || "tenant",
            data.resident_move_in_date || null,
            data.resident_move_out_date || null,
            data.resident_notes || null,
            existing.id,
          );
        } else {
          db.prepare(
            `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            data.resident_name.trim(),
            data.resident_phone || null,
            data.resident_email || null,
            data.resident_national_id || null,
            data.resident_type || "tenant",
            data.resident_move_in_date || null,
            data.resident_move_out_date || null,
            data.resident_notes || null,
          );
        }
      } else if (existing) {
        db.prepare(
          `UPDATE residents SET is_active = 0, move_out_date = date('now'), updated_at = datetime('now') WHERE id = ?`,
        ).run(existing.id);
      }
    });

    updateTx();
    return { success: true, message: "Daire başarıyla güncellendi." };
  } catch (err) {
    if (err.message === "not_found") return { success: false, message: "Daire bulunamadı." };
    return { success: false, message: resolveDbError(err, "Daire güncelleme") };
  }
}

function deleteApartment(id, managerId) {
  try {
    const result = db.prepare(`DELETE FROM apartments WHERE id = ? AND manager_id = ?`).run(id, managerId);
    if (result.changes === 0) return { success: false, message: "Daire bulunamadı." };
    return { success: true, message: "Daire ve ilgili tüm aidat kayıtları silindi." };
  } catch (err) {
    return { success: false, message: resolveDbError(err, "Daire silme") };
  }
}

function bulkUpdateDueAmount(managerId, amount) {
  try {
    const result = db.prepare(`UPDATE apartments SET due_amount = ?, updated_at = datetime('now') WHERE manager_id = ?`).run(amount, managerId);
    return { success: true, message: `${result.changes} dairenin aidat tutarı güncellendi.`, count: result.changes };
  } catch (err) {
    return { success: false, message: resolveDbError(err, "Toplu güncelleme") };
  }
}

module.exports = { addApartment, updateApartment, deleteApartment, bulkUpdateDueAmount };

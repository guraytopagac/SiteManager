const { db } = require("../../database/db");

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

function extractConstraintCol(msg, prefix) {
  const col = msg.split(prefix)[1]?.trim() ?? "";
  return col.split(".").pop();
}

function resolveDbError(err, context) {
  const msg = err.message ?? "";

  if (msg.includes("UNIQUE constraint failed")) {
    const col = extractConstraintCol(msg, "UNIQUE constraint failed:");
    const label = COLUMN_LABELS[col] ?? "Alan";
    return `${label} zaten kullanılıyor.`;
  }

  if (msg.includes("CHECK constraint failed")) {
    const col = extractConstraintCol(msg, "CHECK constraint failed:");
    if (col === "phone") return "Telefon numarası geçersiz. En az 10 karakter, yalnızca rakam ve +()- içerebilir.";
    if (col === "national_id") return "TC Kimlik No 11 haneli rakamdan oluşmalıdır.";
    if (col === "email") return "Geçersiz e-posta adresi.";
    if (col === "due_amount") return "Aidat tutarı 0'dan büyük ve 50.000₺'den küçük olmalıdır.";
    if (col === "floor") return "Kat -2 ile 99 arasında olmalıdır.";
    if (col === "square_meters") return "Metrekare 0'dan büyük ve 1000'den küçük olmalıdır.";
    const label = COLUMN_LABELS[col];
    if (label) return `${label} geçersiz bir değer içeriyor.`;
    return `${context} sırasında girilen bilgilerden biri geçersiz. Lütfen kontrol edin.`;
  }

  if (msg.includes("NOT NULL constraint failed")) {
    const col = extractConstraintCol(msg, "NOT NULL constraint failed:");
    const label = COLUMN_LABELS[col] ?? col ?? "Zorunlu alan";
    return `${label} boş bırakılamaz.`;
  }

  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "İlişkili kayıt bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
  }

  return `${context} sırasında beklenmeyen bir hata oluştu.`;
}

function hasResidentData(data) {
  return (
    data.resident_name?.trim() ||
    data.resident_phone?.trim() ||
    data.resident_email?.trim() ||
    data.resident_national_id?.trim() ||
    data.resident_move_in_date?.trim() ||
    data.resident_move_out_date?.trim() ||
    data.resident_notes?.trim()
  );
}

function addApartment(apartmentData) {
  try {
    db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          apartmentData.apartment_no,
          apartmentData.floor,
          apartmentData.type,
          apartmentData.square_meters,
          apartmentData.due_amount,
          apartmentData.manager_id,
        );

      if (hasResidentData(apartmentData)) {
        db.prepare(
          `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          result.lastInsertRowid,
          apartmentData.resident_name?.trim() || null,
          apartmentData.resident_phone?.trim() || null,
          apartmentData.resident_email?.trim() || null,
          apartmentData.resident_national_id?.trim() || null,
          apartmentData.resident_type || null,
          apartmentData.resident_move_in_date || null,
          apartmentData.resident_move_out_date || null,
          apartmentData.resident_notes?.trim() || null,
        );
      }
    })();
    return { success: true, message: "Daire eklendi." };
  } catch (err) {
    console.error("[apartment] addApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire ekleme") };
  }
}

function updateApartment(id, apartmentData) {
  try {
    db.transaction(() => {
      const result = db
        .prepare(
          `UPDATE apartments
           SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?, updated_at = datetime('now')
           WHERE id = ? AND manager_id = ?`,
        )
        .run(
          apartmentData.apartment_no,
          apartmentData.floor,
          apartmentData.type,
          apartmentData.square_meters,
          apartmentData.due_amount,
          id,
          apartmentData.manager_id,
        );

      if (result.changes === 0) throw new Error("not_found");

      const existingResident = db.prepare(`SELECT id FROM residents WHERE apartment_id = ? AND is_active = 1`).get(id);

      if (hasResidentData(apartmentData)) {
        if (existingResident) {
          db.prepare(
            `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
             move_in_date = ?, move_out_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
          ).run(
            apartmentData.resident_name?.trim() || null,
            apartmentData.resident_phone?.trim() || null,
            apartmentData.resident_email?.trim() || null,
            apartmentData.resident_national_id?.trim() || null,
            apartmentData.resident_type || null,
            apartmentData.resident_move_in_date || null,
            apartmentData.resident_move_out_date || null,
            apartmentData.resident_notes?.trim() || null,
            existingResident.id,
          );
        } else {
          db.prepare(
            `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            apartmentData.resident_name?.trim() || null,
            apartmentData.resident_phone?.trim() || null,
            apartmentData.resident_email?.trim() || null,
            apartmentData.resident_national_id?.trim() || null,
            apartmentData.resident_type || null,
            apartmentData.resident_move_in_date || null,
            apartmentData.resident_move_out_date || null,
            apartmentData.resident_notes?.trim() || null,
          );
        }
      } else if (existingResident) {
        db.prepare(
          `UPDATE residents SET is_active = 0, move_out_date = date('now'), updated_at = datetime('now') WHERE id = ?`,
        ).run(existingResident.id);
      }
    })();
    return { success: true, message: "Daire başarıyla güncellendi." };
  } catch (err) {
    if (err.message === "not_found")
      return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    console.error("[apartment] updateApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire güncelleme") };
  }
}

function deleteApartment(id, managerId) {
  try {
    const result = db
      .prepare(`UPDATE apartments SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND manager_id = ?`)
      .run(id, managerId);
    if (result.changes === 0) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    return { success: true, message: "Daire pasife alındı." };
  } catch (err) {
    console.error("[apartment.service] deleteApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire silme") };
  }
}

function bulkUpdateDueAmount(managerId, amount) {
  try {
    const result = db
      .prepare(
        `UPDATE apartments SET due_amount = ?, updated_at = datetime('now') WHERE manager_id = ? AND is_active = 1`,
      )
      .run(amount, managerId);
    return { success: true, message: `${result.changes} dairenin aidat tutarı güncellendi.`, count: result.changes };
  } catch (err) {
    console.error("[apartment.service] bulkUpdateDueAmount:", err);
    return { success: false, message: resolveDbError(err, "Toplu güncelleme") };
  }
}

module.exports = { addApartment, updateApartment, deleteApartment, bulkUpdateDueAmount };

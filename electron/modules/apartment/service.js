const { db } = require("../../../database/db");

const COLUMN_LABELS = {
  apartment_no: "Daire numarası",
  floor: "Kat",
  type: "Daire tipi",
  square_meters: "Metrekare",
  due_amount: "Aidat tutarı",
};

function extractConstraintCol(msg, prefix) {
  const raw = msg.split(prefix)[1]?.trim();
  if (!raw) return null;

  const cols = raw
    .split(",")
    .map((part) => part.trim().split(".").pop())
    .filter(Boolean);
  if (cols.length === 0) return null;

  return cols.find((col) => col in COLUMN_LABELS) ?? cols[0];
}

function resolveDbError(err, context) {
  const msg = err.message ?? "";

  if (msg.includes("UNIQUE constraint failed")) {
    const col = extractConstraintCol(msg, "UNIQUE constraint failed:");
    const label = COLUMN_LABELS[col] ?? "Alan";
    return `${label} zaten kullanılıyor.`;
  }

  if (msg.includes("CHECK constraint failed")) {
    return `${context} sırasında girilen değerlerden biri geçerli aralıkta değil. Lütfen kontrol edin.`;
  }

  if (msg.includes("NOT NULL constraint failed")) {
    const col = extractConstraintCol(msg, "NOT NULL constraint failed:");
    const label = COLUMN_LABELS[col] ?? "Zorunlu alan";
    return `${label} boş bırakılamaz.`;
  }

  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "İlişkili kayıt bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
  }

  return `${context} sırasında beklenmeyen bir hata oluştu.`;
}

function addApartment(apartmentData) {
  try {
    db.prepare(
      `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      apartmentData.apartment_no,
      apartmentData.floor,
      apartmentData.type,
      apartmentData.square_meters,
      apartmentData.due_amount,
      apartmentData.managerId,
    );
    return { success: true, message: "Daire eklendi." };
  } catch (err) {
    console.error("[apartment.service] addApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire ekleme") };
  }
}

function updateApartment(id, apartmentData) {
  try {
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
        apartmentData.managerId,
      );

    if (result.changes === 0) {
      return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    }

    return { success: true, message: "Daire başarıyla güncellendi." };
  } catch (err) {
    console.error("[apartment.service] updateApartment:", err);
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

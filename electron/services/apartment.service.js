const db = require("../../database/db");

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
        db.prepare(
          `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          result.lastInsertRowid,
          data.resident_name.trim(),
          data.resident_phone || null,
          data.resident_email || null,
          data.resident_national_id || null,
          data.resident_type || "tenant",
          data.resident_move_in_date || null,
          data.resident_notes || null,
        );
      }
    });

    addTx();
    return { success: true, message: "Daire eklendi." };
  } catch {
    return { success: false, message: "Daire eklenemedi. Daire numarası benzersiz olmalıdır." };
  }
}

function getApartments(userId) {
  try {
    const data = db
      .prepare(
        `SELECT a.id, a.apartment_no, a.floor, a.type, a.square_meters, a.due_amount, a.created_at,
                r.full_name AS resident_name, r.phone AS resident_phone, r.email AS resident_email,
                r.national_id AS resident_national_id, r.resident_type, r.move_in_date AS resident_move_in_date,
                r.notes AS resident_notes
         FROM apartments a
         LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
         WHERE a.manager_id = ?`,
      )
      .all(userId);
    return { success: true, data };
  } catch {
    return { success: false, message: "Veriler alınamadı." };
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
             move_in_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
          ).run(
            data.resident_name.trim(),
            data.resident_phone || null,
            data.resident_email || null,
            data.resident_national_id || null,
            data.resident_type || "tenant",
            data.resident_move_in_date || null,
            data.resident_notes || null,
            existing.id,
          );
        } else {
          db.prepare(
            `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            data.resident_name.trim(),
            data.resident_phone || null,
            data.resident_email || null,
            data.resident_national_id || null,
            data.resident_type || "tenant",
            data.resident_move_in_date || null,
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
    return { success: false, message: "Daire güncellenemedi. Daire numarası benzersiz olmalıdır." };
  }
}

function deleteApartment(id, managerId) {
  try {
    const result = db.prepare(`DELETE FROM apartments WHERE id = ? AND manager_id = ?`).run(id, managerId);
    if (result.changes === 0) return { success: false, message: "Daire bulunamadı." };
    return { success: true, message: "Daire ve ilgili tüm aidat kayıtları silindi." };
  } catch {
    return { success: false, message: "Daire silinemedi." };
  }
}

function bulkUpdateDueAmount(managerId, amount) {
  try {
    const result = db.prepare(`UPDATE apartments SET due_amount = ? WHERE manager_id = ?`).run(amount, managerId);
    return { success: true, message: `${result.changes} dairenin aidat tutarı güncellendi.`, count: result.changes };
  } catch {
    return { success: false, message: "Toplu güncelleme başarısız." };
  }
}

function getResidentHistory(apartmentId) {
  try {
    const data = db
      .prepare(
        `SELECT id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date,
                is_active, notes, created_at
         FROM residents WHERE apartment_id = ? ORDER BY move_in_date DESC, created_at DESC`,
      )
      .all(apartmentId);
    return { success: true, data };
  } catch {
    return { success: false, message: "Sakin geçmişi alınamadı." };
  }
}

module.exports = { addApartment, getApartments, updateApartment, deleteApartment, bulkUpdateDueAmount, getResidentHistory };

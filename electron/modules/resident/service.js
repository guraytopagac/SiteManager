const { db } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const COLUMN_LABELS = {
  phone: "Telefon numarası",
  email: "E-posta adresi",
  national_id: "TC Kimlik No",
  move_in_date: "Giriş tarihi",
  move_out_date: "Çıkış tarihi",
  full_name: "Ad Soyad",
  resident_type: "Sakin türü",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function findOwnedActiveApartment(apartmentId, managerId) {
  return db
    .prepare(`SELECT id FROM apartments WHERE id = ? AND manager_id = ? AND is_active = 1`)
    .get(apartmentId, managerId);
}

function findOwnedResident(residentId, managerId) {
  return db
    .prepare(
      `SELECT r.id, r.apartment_id FROM residents r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = ? AND a.manager_id = ?`,
    )
    .get(residentId, managerId);
}

function getResidentsOverview(managerId) {
  try {
    const data = db
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
                r.id AS resident_id, r.full_name, r.phone, r.email, r.national_id,
                r.resident_type, r.move_in_date, r.move_out_date, r.notes
         FROM apartments a
         LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
         WHERE a.manager_id = ? AND a.is_active = 1
         ORDER BY a.apartment_no ASC`,
      )
      .all(managerId);

    return { success: true, data };
  } catch (err) {
    console.error("[resident.service] getResidentsOverview:", err);
    return { success: false, message: "Sakin verileri alınamadı." };
  }
}

function getResidentHistory(apartmentId, managerId) {
  try {
    if (!findOwnedActiveApartment(apartmentId, managerId)) {
      return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    }

    const data = db
      .prepare(
        `SELECT id, full_name, phone, email, national_id, resident_type,
                move_in_date, move_out_date, is_active, notes, created_at
         FROM residents
         WHERE apartment_id = ?
         ORDER BY is_active DESC, move_in_date DESC, id DESC`,
      )
      .all(apartmentId);

    return { success: true, data };
  } catch (err) {
    console.error("[resident.service] getResidentHistory:", err);
    return { success: false, message: "Sakin geçmişi alınamadı." };
  }
}

function addResident(payload) {
  const { apartmentId, managerId } = payload;
  try {
    let inserted = false;
    db.transaction(() => {
      if (!findOwnedActiveApartment(apartmentId, managerId)) throw new Error("not_found");

      const existingActiveResident = db
        .prepare(`SELECT id FROM residents WHERE apartment_id = ? AND is_active = 1`)
        .get(apartmentId);
      if (existingActiveResident) throw new Error("active_exists");

      db.prepare(
        `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
      ).run(
        apartmentId,
        payload.full_name || null,
        payload.phone || null,
        payload.email || null,
        payload.national_id || null,
        payload.resident_type || null,
        payload.move_in_date || null,
        payload.move_out_date || null,
        payload.notes || null,
      );
      inserted = true;
    })();

    if (inserted) return { success: true, message: "Sakin eklendi." };
    return { success: false, message: "Sakin eklenemedi." };
  } catch (err) {
    if (err.message === "not_found")
      return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    if (err.message === "active_exists")
      return { success: false, message: "Bu dairede aktif bir sakin var. Önce çıkış yaptırın." };
    console.error("[resident.service] addResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin ekleme") };
  }
}

function updateResident(payload) {
  const { residentId, managerId } = payload;
  try {
    const owned = findOwnedResident(residentId, managerId);
    if (!owned) return { success: false, message: "Sakin bulunamadı veya bu işlem için yetkiniz yok." };

    db.prepare(
      `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
       move_in_date = ?, move_out_date = ?, notes = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`,
    ).run(
      payload.full_name || null,
      payload.phone || null,
      payload.email || null,
      payload.national_id || null,
      payload.resident_type || null,
      payload.move_in_date || null,
      payload.move_out_date || null,
      payload.notes || null,
      residentId,
    );

    return { success: true, message: "Sakin bilgileri güncellendi." };
  } catch (err) {
    console.error("[resident.service] updateResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin güncelleme") };
  }
}

function moveOutResident(payload) {
  const { residentId, managerId, moveOutDate } = payload;
  try {
    const owned = findOwnedResident(residentId, managerId);
    if (!owned) return { success: false, message: "Sakin bulunamadı veya bu işlem için yetkiniz yok." };

    db.prepare(`UPDATE residents SET move_out_date = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`).run(
      moveOutDate,
      residentId,
    );

    return { success: true, message: "Sakin çıkışı kaydedildi." };
  } catch (err) {
    console.error("[resident.service] moveOutResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin çıkışı") };
  }
}

module.exports = { getResidentsOverview, getResidentHistory, addResident, updateResident, moveOutResident };

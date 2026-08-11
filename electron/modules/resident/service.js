const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL } = require("../shared/trTime");

const COLUMN_LABELS = {
  phone: "Telefon numarası",
  email: "E-posta adresi",
  national_id: "TC Kimlik No",
  move_in_date: "Giriş tarihi",
  move_out_date: "Çıkış tarihi",
  full_name: "Ad Soyad",
  resident_type: "Sakin türü",
};

const APARTMENT_NOT_FOUND_MESSAGE = "Daire bulunamadı veya bu işlem için yetkiniz yok.";
const RESIDENT_NOT_FOUND_MESSAGE = "Sakin bulunamadı veya bu işlem için yetkiniz yok.";

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function findOwnedApartment(apartmentId, buildingId) {
  return getDb().prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ?`).get(apartmentId, buildingId);
}

function findOwnedActiveApartment(apartmentId, buildingId) {
  return getDb()
    .prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
    .get(apartmentId, buildingId);
}

function findOwnedResident(residentId, buildingId) {
  return getDb()
    .prepare(
      `SELECT r.id, r.apartment_id FROM residents r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = ? AND a.building_id = ?`,
    )
    .get(residentId, buildingId);
}

function getResidentsOverview(payload) {
  const { buildingId } = payload;
  try {
    const data = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
                r.id AS resident_id, r.full_name, r.phone, r.email, r.national_id,
                r.resident_type, r.move_in_date, r.move_out_date, r.notes
         FROM apartments a
         LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
         WHERE a.building_id = ? AND a.is_active = 1
         ORDER BY a.apartment_no ASC`,
      )
      .all(buildingId);

    return { success: true, data };
  } catch (err) {
    console.error("[resident.service] getResidentsOverview:", err);
    return { success: false, message: "Sakin verileri alınamadı." };
  }
}

function getResidentHistory(payload) {
  const { apartmentId, buildingId } = payload;
  try {
    if (!findOwnedApartment(apartmentId, buildingId)) {
      return { success: false, message: APARTMENT_NOT_FOUND_MESSAGE };
    }

    const data = getDb()
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
  const { apartmentId, buildingId } = payload;
  try {
    if (!findOwnedActiveApartment(apartmentId, buildingId))
      return { success: false, message: APARTMENT_NOT_FOUND_MESSAGE };

    const existingActiveResident = getDb()
      .prepare(`SELECT id FROM residents WHERE apartment_id = ? AND is_active = 1`)
      .get(apartmentId);
    if (existingActiveResident)
      return { success: false, message: "Bu dairede aktif bir sakin var. Önce çıkış yaptırın." };

    getDb()
      .prepare(
        `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, move_in_date, move_out_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(
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

    return { success: true, message: "Sakin eklendi." };
  } catch (err) {
    console.error("[resident.service] addResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin ekleme") };
  }
}

function updateResident(payload) {
  const { residentId, buildingId } = payload;
  try {
    if (!findOwnedResident(residentId, buildingId)) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };

    getDb()
      .prepare(
        `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
         move_in_date = ?, notes = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(
        payload.full_name || null,
        payload.phone || null,
        payload.email || null,
        payload.national_id || null,
        payload.resident_type || null,
        payload.move_in_date || null,
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
  const { residentId, buildingId, moveOutDate } = payload;
  try {
    if (!findOwnedResident(residentId, buildingId)) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };

    getDb()
      .prepare(`UPDATE residents SET move_out_date = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
      .run(moveOutDate, residentId);

    return { success: true, message: "Sakin çıkışı kaydedildi." };
  } catch (err) {
    console.error("[resident.service] moveOutResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin çıkışı") };
  }
}

module.exports = { getResidentsOverview, getResidentHistory, addResident, updateResident, moveOutResident };

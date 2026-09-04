// Resident rules. Each step is its own action instead of being part of the apartment form: add,
// update, move out. Replacing a resident means a move out followed by an add.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL, trToday } = require("../shared/trTime");

const APARTMENT_NOT_FOUND_MESSAGE = "Daire bulunamadı veya bu işlem için yetkiniz yok.";
const RESIDENT_NOT_FOUND_MESSAGE = "Sakin bulunamadı veya bu işlem için yetkiniz yok.";
const RESIDENT_INACTIVE_MESSAGE = "Bu sakin çıkış yapmış, geçmiş kaydı değiştirilemez.";

// No labels on purpose. residents has no UNIQUE index and every column that could be labelled
// may be null, so every error on this table is a CHECK.
const resolveDbError = createDbErrorResolver();

// Does not care whether the apartment is active, so the history of an old apartment stays readable.
function findOwnedApartment(apartmentId, buildingId) {
  return getDb().prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ?`).get(apartmentId, buildingId);
}

// Writing also needs the apartment to be active.
function findOwnedActiveApartment(apartmentId, buildingId) {
  return getDb()
    .prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
    .get(apartmentId, buildingId);
}

// Checks the owner through the apartment, and returns is_active for the caller to test.
function findOwnedResident(residentId, buildingId) {
  return getDb()
    .prepare(
      `SELECT r.id, r.is_active FROM residents r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = ? AND a.building_id = ?`,
    )
    .get(residentId, buildingId);
}

// LEFT JOIN, so an apartment with no resident still shows up.
function getResidentsOverview(payload) {
  const { buildingId } = payload;
  try {
    const data = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
                r.id AS resident_id, r.full_name, r.phone, r.email, r.national_id,
                r.resident_type, r.household_size, r.move_in_date, r.move_out_date, r.notes
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
        `SELECT id, full_name, resident_type, household_size, move_in_date, move_out_date, is_active
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
        `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, household_size, move_in_date, move_out_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(
        apartmentId,
        payload.full_name,
        payload.phone,
        payload.email,
        payload.national_id,
        payload.resident_type,
        payload.household_size,
        payload.move_in_date,
        payload.move_out_date,
        payload.notes,
      );

    return { success: true, message: "Sakin eklendi." };
  } catch (err) {
    console.error("[resident.service] addResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin ekleme") };
  }
}

// Overwrites the active resident row. An empty field means the user cleared it, and a past
// resident can never be edited. move_out_date is left out of the column list on purpose.
function updateResident(payload) {
  const { residentId, buildingId } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };
    if (!resident.is_active) return { success: false, message: RESIDENT_INACTIVE_MESSAGE };

    getDb()
      .prepare(
        `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
         household_size = ?, move_in_date = ?, notes = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(
        payload.full_name,
        payload.phone,
        payload.email,
        payload.national_id,
        payload.resident_type,
        payload.household_size,
        payload.move_in_date,
        payload.notes,
        residentId,
      );

    return { success: true, message: "Sakin bilgileri güncellendi." };
  } catch (err) {
    console.error("[resident.service] updateResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin güncelleme") };
  }
}

// Sets the move-out date, and the trigger then deactivates the resident. A later date keeps them
// active, so the message says which of the two happened.
function moveOutResident(payload) {
  const { residentId, buildingId, moveOutDate } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };
    if (!resident.is_active) return { success: false, message: "Bu sakin zaten çıkış yapmış." };

    getDb()
      .prepare(`UPDATE residents SET move_out_date = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
      .run(moveOutDate, residentId);

    return {
      success: true,
      message:
        moveOutDate > trToday()
          ? "Çıkış tarihi kaydedildi. Sakin bu tarihe kadar aktif kalmaya devam edecek."
          : "Sakin çıkışı kaydedildi.",
    };
  } catch (err) {
    console.error("[resident.service] moveOutResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin çıkışı") };
  }
}

module.exports = { getResidentsOverview, getResidentHistory, addResident, updateResident, moveOutResident };

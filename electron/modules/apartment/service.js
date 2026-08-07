const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const COLUMN_LABELS = {
  apartment_no: "Daire numarası",
  floor: "Kat",
  type: "Daire tipi",
  square_meters: "Metrekare",
  due_amount: "Aidat tutarı",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function addApartment(apartmentData) {
  try {
    getDb().prepare(
      `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
    ).run(
      apartmentData.apartment_no,
      apartmentData.floor,
      apartmentData.type,
      apartmentData.square_meters,
      apartmentData.due_amount,
      apartmentData.buildingId,
    );
    return { success: true, message: "Daire eklendi." };
  } catch (err) {
    console.error("[apartment.service] addApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire ekleme") };
  }
}

function updateApartment(id, apartmentData) {
  try {
    const result = getDb()
      .prepare(
        `UPDATE apartments
         SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?, updated_at = datetime('now', '+3 hours')
         WHERE id = ? AND building_id = ?`,
      )
      .run(
        apartmentData.apartment_no,
        apartmentData.floor,
        apartmentData.type,
        apartmentData.square_meters,
        apartmentData.due_amount,
        id,
        apartmentData.buildingId,
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

function deleteApartment(id, buildingId) {
  try {
    const result = getDb()
      .prepare(
        `UPDATE apartments SET is_active = 0, updated_at = datetime('now', '+3 hours') WHERE id = ? AND building_id = ?`,
      )
      .run(id, buildingId);
    if (result.changes === 0) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };
    return { success: true, message: "Daire pasife alındı." };
  } catch (err) {
    console.error("[apartment.service] deleteApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire silme") };
  }
}

function bulkUpdateDueAmount(buildingId, amount) {
  try {
    const result = getDb()
      .prepare(
        `UPDATE apartments SET due_amount = ?, updated_at = datetime('now', '+3 hours') WHERE building_id = ? AND is_active = 1`,
      )
      .run(amount, buildingId);
    return { success: true, message: `${result.changes} dairenin aidat tutarı güncellendi.`, count: result.changes };
  } catch (err) {
    console.error("[apartment.service] bulkUpdateDueAmount:", err);
    return { success: false, message: resolveDbError(err, "Toplu güncelleme") };
  }
}

module.exports = { addApartment, updateApartment, deleteApartment, bulkUpdateDueAmount };

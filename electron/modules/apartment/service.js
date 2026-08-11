const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { TR_NOW_SQL, trToday } = require("../shared/trTime");

const COLUMN_LABELS = { apartment_no: "Daire numarası" };

const NOT_FOUND_MESSAGE = "Daire bulunamadı.";
const DUPLICATE_ACTIVE_MESSAGE = "Bu numarada bir daire zaten var.";
const DUPLICATE_INACTIVE_MESSAGE =
  "Bu numarada pasife alınmış bir daire var. Aynı numarayı yeniden kullanmak için daireyi ekleyin, kayıt yeniden aktifleştirilir.";

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function checkBuildingUsable(buildingId) {
  const building = getDb().prepare(`SELECT is_active FROM buildings WHERE id = ? AND is_removed = 0`).get(buildingId);

  if (!building) {
    return { success: false, message: "Bina bulunamadı." };
  }
  if (building.is_active === 0) {
    return { success: false, message: "Arşivlenmiş bir binada daire işlemi yapılamaz." };
  }
  return null;
}

function findApartmentByNo(buildingId, apartmentNo, excludeId) {
  return getDb()
    .prepare(
      `SELECT id, is_active FROM apartments
       WHERE building_id = ? AND apartment_no = ? COLLATE NOCASE AND id != COALESCE(?, 0)`,
    )
    .get(buildingId, apartmentNo, excludeId ?? null);
}

function apartmentValues(payload) {
  return [payload.apartment_no, payload.floor ?? null, payload.type, payload.square_meters ?? null, payload.due_amount];
}

function addApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const existing = findApartmentByNo(payload.buildingId, payload.apartment_no);
    if (existing?.is_active === 1) {
      return { success: false, message: DUPLICATE_ACTIVE_MESSAGE };
    }

    if (existing) {
      getDb()
        .prepare(
          `UPDATE apartments
           SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?,
               is_active = 1, created_at = ${TR_NOW_SQL}, updated_at = ${TR_NOW_SQL}
           WHERE id = ?`,
        )
        .run(...apartmentValues(payload), existing.id);

      return { success: true, message: "Daire yeniden aktifleştirildi." };
    }

    getDb()
      .prepare(
        `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, building_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(...apartmentValues(payload), payload.buildingId);

    return { success: true, message: "Daire eklendi." };
  } catch (err) {
    console.error("[apartment.service] addApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire ekleme") };
  }
}

function updateApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const duplicate = findApartmentByNo(payload.buildingId, payload.apartment_no, payload.id);
    if (duplicate) {
      return {
        success: false,
        message: duplicate.is_active === 1 ? DUPLICATE_ACTIVE_MESSAGE : DUPLICATE_INACTIVE_MESSAGE,
      };
    }

    const result = getDb()
      .prepare(
        `UPDATE apartments
         SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?, updated_at = ${TR_NOW_SQL}
         WHERE id = ? AND building_id = ? AND is_active = 1`,
      )
      .run(...apartmentValues(payload), payload.id, payload.buildingId);

    if (result.changes === 0) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }

    return { success: true, message: "Daire güncellendi." };
  } catch (err) {
    console.error("[apartment.service] updateApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire güncelleme") };
  }
}

function deleteApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const db = getDb();

    const apartment = db
      .prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
      .get(payload.id, payload.buildingId);
    if (!apartment) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }

    if (payload.force !== true) {
      ensureMonthlyDues(payload.buildingId);

      const { unpaidTotal } = db
        .prepare(
          `SELECT COALESCE(SUM(due_amount - paid_amount), 0) AS unpaidTotal
           FROM dues WHERE apartment_id = ? AND status != 'paid'`,
        )
        .get(payload.id);

      if (unpaidTotal > 0) {
        return {
          success: false,
          code: "HAS_UNPAID_DUES",
          unpaidTotal,
          message: "Bu dairenin ödenmemiş aidat borcu var.",
        };
      }
    }

    const moveOutDate = trToday();

    db.transaction(() => {
      db.prepare(`UPDATE apartments SET is_active = 0, updated_at = ${TR_NOW_SQL} WHERE id = ?`).run(payload.id);
      db.prepare(
        `UPDATE residents
         SET move_out_date = COALESCE(move_out_date, ?), is_active = 0, updated_at = ${TR_NOW_SQL}
         WHERE apartment_id = ? AND is_active = 1`,
      ).run(moveOutDate, payload.id);
    })();

    return { success: true, message: "Daire pasife alındı." };
  } catch (err) {
    console.error("[apartment.service] deleteApartment:", err);
    return { success: false, message: "Daire pasife alınırken beklenmeyen bir hata oluştu." };
  }
}

function bulkUpdateDueAmount(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const result = getDb()
      .prepare(
        `UPDATE apartments SET due_amount = ?, updated_at = ${TR_NOW_SQL} WHERE building_id = ? AND is_active = 1`,
      )
      .run(payload.amount, payload.buildingId);

    if (result.changes === 0) {
      return { success: false, message: "Güncellenecek aktif daire bulunamadı." };
    }

    return { success: true, message: `${result.changes} dairenin aidat tutarı güncellendi.` };
  } catch (err) {
    console.error("[apartment.service] bulkUpdateDueAmount:", err);
    return { success: false, message: "Toplu güncelleme sırasında beklenmeyen bir hata oluştu." };
  }
}

module.exports = { addApartment, updateApartment, deleteApartment, bulkUpdateDueAmount };

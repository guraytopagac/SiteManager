// Apartment rules. An apartment is only soft-deleted, and a new apartment may take its number.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { TR_NOW_SQL, trToday, trYearMonth } = require("../shared/trTime");

// Only apartment_no can produce a named message, because it is the one column in a UNIQUE index.
const COLUMN_LABELS = { apartment_no: "Daire numarası" };

const NOT_FOUND_MESSAGE = "Daire bulunamadı.";
const DUPLICATE_ACTIVE_MESSAGE = "Bu numarada bir daire zaten var.";

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// All four endpoints refuse a removed or archived building.
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

// Only active rows, because the unique index is partial. A deleted apartment keeps its number in
// the table but never blocks a new one.
function findActiveApartmentByNo(buildingId, apartmentNo, excludeId) {
  return getDb()
    .prepare(
      `SELECT id FROM apartments
       WHERE building_id = ? AND apartment_no = ? COLLATE NOCASE AND is_active = 1
         AND id != COALESCE(?, 0)`,
    )
    .get(buildingId, apartmentNo, excludeId ?? null);
}

// due_amount is nullable on the update path, where COALESCE keeps the amount already stored.
function apartmentValues(payload) {
  return [payload.apartment_no, payload.floor, payload.type, payload.square_meters ?? null, payload.due_amount ?? null];
}

// Always inserts a new row. Reviving the inactive row with the same number would carry its dues,
// payment history and residents into what the user means to be a brand new apartment.
function addApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    if (findActiveApartmentByNo(payload.buildingId, payload.apartment_no)) {
      return { success: false, message: DUPLICATE_ACTIVE_MESSAGE };
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

function hasPaymentThisMonth(apartmentId, year, month) {
  return !!getDb()
    .prepare(`SELECT 1 FROM dues WHERE apartment_id = ? AND year = ? AND month = ? AND paid_amount > 0`)
    .get(apartmentId, year, month);
}

// Never touches residents or past months. An amount is only written when the caller sends one, so
// editing an apartment from the building view leaves the dues alone. When it is sent, the caller
// also says whether the current month follows it, and even then only while no payment has been
// collected: lowering due_amount under paid_amount breaks the CHECK on dues, and rewriting a month
// the user already collected for would corrupt their record.
function updateApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    if (findActiveApartmentByNo(payload.buildingId, payload.apartment_no, payload.id)) {
      return { success: false, message: DUPLICATE_ACTIVE_MESSAGE };
    }

    const { year, month } = trYearMonth();
    const dueAmount = payload.due_amount ?? null;

    const applyUpdate = getDb().transaction(() => {
      const updated = getDb()
        .prepare(
          `UPDATE apartments
           SET apartment_no = ?, floor = ?, type = ?, square_meters = ?,
               due_amount = COALESCE(?, due_amount), updated_at = ${TR_NOW_SQL}
           WHERE id = ? AND building_id = ? AND is_active = 1`,
        )
        .run(...apartmentValues(payload), payload.id, payload.buildingId).changes;

      if (updated === 0 || dueAmount == null || !payload.applyCurrentMonth) {
        return { updated, accrued: 0 };
      }

      const accrued = getDb()
        .prepare(
          `UPDATE dues SET due_amount = ?, updated_at = ${TR_NOW_SQL}
           WHERE apartment_id = ? AND year = ? AND month = ? AND paid_amount = 0`,
        )
        .run(dueAmount, payload.id, year, month).changes;

      return { updated, accrued };
    });

    const { updated, accrued } = applyUpdate();

    if (updated === 0) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }

    if (dueAmount == null) {
      return { success: true, message: `Daire ${payload.apartment_no} güncellendi.` };
    }

    // No row changed means either this month has a payment or it is not accrued yet. Only the first
    // one is worth a word, the second month will be created with the new amount anyway.
    if (payload.applyCurrentMonth && accrued === 0 && hasPaymentThisMonth(payload.id, year, month)) {
      return {
        success: true,
        message: `Daire ${payload.apartment_no} aidatı güncellendi, bu ay ödeme alındığı için bu ayın aidatı değişmedi.`,
      };
    }

    if (payload.applyCurrentMonth && accrued > 0) {
      return {
        success: true,
        message: `Daire ${payload.apartment_no} aidatı güncellendi, yeni tutar bu aya da işlendi.`,
      };
    }

    return { success: true, message: `Daire ${payload.apartment_no} aidatı güncellendi.` };
  } catch (err) {
    console.error("[apartment.service] updateApartment:", err);
    return { success: false, message: resolveDbError(err, "Daire güncelleme") };
  }
}

// Soft delete. Unpaid debt is refused once, and it goes through when the renderer retries with force.
function deleteApartment(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const db = getDb();

    const apartment = db
      .prepare(`SELECT id, apartment_no FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
      .get(payload.id, payload.buildingId);
    if (!apartment) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }

    if (payload.force !== true) {
      // Accrue first, or a month that has not been created yet would look paid.
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

    // COALESCE keeps a move-out date the user entered before, even a later one.
    const moveOutDate = trToday();

    db.transaction(() => {
      db.prepare(`UPDATE apartments SET is_active = 0, updated_at = ${TR_NOW_SQL} WHERE id = ?`).run(payload.id);
      db.prepare(
        `UPDATE residents
         SET move_out_date = COALESCE(move_out_date, ?), is_active = 0, updated_at = ${TR_NOW_SQL}
         WHERE apartment_id = ? AND is_active = 1`,
      ).run(moveOutDate, payload.id);
    })();

    return { success: true, message: `Daire ${apartment.apartment_no} silindi.` };
  } catch (err) {
    console.error("[apartment.service] deleteApartment:", err);
    return { success: false, message: "Daire silinirken beklenmeyen bir hata oluştu." };
  }
}

// An apartment whose current month already has a payment keeps its accrued amount. Lowering it
// below paid_amount would also break the CHECK on dues.
function countPaidThisMonth(buildingId, year, month) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS total FROM dues d
       JOIN apartments a ON a.id = d.apartment_id
       WHERE a.building_id = ? AND a.is_active = 1 AND d.year = ? AND d.month = ? AND d.paid_amount > 0`,
    )
    .get(buildingId, year, month).total;
}

// Writes the new amount to every active apartment. Accrued dues rows keep the amount they already
// have, unless the caller asks for the current month, which is rewritten apartment by apartment.
function bulkUpdateDueAmount(payload) {
  try {
    const buildingError = checkBuildingUsable(payload.buildingId);
    if (buildingError) {
      return buildingError;
    }

    const { year, month } = trYearMonth();

    const applyAmount = getDb().transaction(() => {
      const updated = getDb()
        .prepare(
          `UPDATE apartments SET due_amount = ?, updated_at = ${TR_NOW_SQL} WHERE building_id = ? AND is_active = 1`,
        )
        .run(payload.amount, payload.buildingId).changes;

      if (updated === 0 || !payload.applyCurrentMonth) {
        return { updated, skipped: 0 };
      }

      getDb()
        .prepare(
          `UPDATE dues SET due_amount = ?, updated_at = ${TR_NOW_SQL}
           WHERE year = ? AND month = ? AND paid_amount = 0
             AND apartment_id IN (SELECT id FROM apartments WHERE building_id = ? AND is_active = 1)`,
        )
        .run(payload.amount, year, month, payload.buildingId);

      return { updated, skipped: countPaidThisMonth(payload.buildingId, year, month) };
    });

    const { updated, skipped } = applyAmount();

    if (updated === 0) {
      return { success: false, message: "Güncellenecek aktif daire bulunamadı." };
    }
    if (skipped > 0) {
      return {
        success: true,
        message: `${updated} dairenin aidatı güncellendi, bu ay ödeme alınan ${skipped} daire eski tutarda kaldı.`,
      };
    }
    if (payload.applyCurrentMonth) {
      return { success: true, message: `${updated} dairenin aidatı güncellendi, yeni tutar bu aya da işlendi.` };
    }

    return { success: true, message: `${updated} dairenin aidatı güncellendi.` };
  } catch (err) {
    console.error("[apartment.service] bulkUpdateDueAmount:", err);
    return { success: false, message: "Toplu güncelleme sırasında beklenmeyen bir hata oluştu." };
  }
}

module.exports = { addApartment, updateApartment, deleteApartment, bulkUpdateDueAmount };

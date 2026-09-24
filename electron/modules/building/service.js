// Building rules. A building row is never deleted. is_active = 0 archives it, is_removed = 1
// removes it, and all five endpoints touch only rows with is_removed = 0.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { applyResidentSchedule } = require("../shared/residentSchedule");
const { ACTIVE_OCCUPANT_ID_SQL } = require("../shared/residentPeriod");
const { TR_NOW_SQL } = require("../shared/trTime");

const COLUMN_LABELS = {
  name: "Bina adı",
};

const NOT_FOUND_MESSAGE = "Bina bulunamadı.";

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// The two counts are subqueries rather than a second round trip, since the picker draws one meta line per
// building. person_count sums household_size of the single occupant row, because one row stands for a whole
// household and an owner who rented the flat out keeps the flag. SUM skips a household of unknown size.
function listBuildings() {
  try {
    applyResidentSchedule();

    const data = getDb()
      .prepare(
        `SELECT b.id, b.name, b.is_active,
                (SELECT COUNT(*) FROM apartments a
                  WHERE a.building_id = b.id AND a.is_active = 1) AS apartment_count,
                (SELECT COALESCE(SUM(occ.household_size), 0) FROM apartments a
                  JOIN residents occ ON occ.id = ${ACTIVE_OCCUPANT_ID_SQL}
                  WHERE a.building_id = b.id AND a.is_active = 1) AS person_count
         FROM buildings b WHERE b.is_removed = 0
         ORDER BY b.is_active DESC, b.name COLLATE NOCASE ASC`,
      )
      .all();
    return { success: true, data };
  } catch (err) {
    console.error("[building.service] listBuildings:", err);
    return { success: false, message: "Bina listesi alınamadı." };
  }
}

// Name check ignoring upper and lower case. The partial unique index is the last line of defence.
function findDuplicateName(name, excludeId = null) {
  return getDb()
    .prepare(
      `SELECT id, is_active FROM buildings
       WHERE is_removed = 0 AND name = ? COLLATE NOCASE AND id IS NOT ?
       LIMIT 1`,
    )
    .get(name, excludeId);
}

function duplicateNameMessage(duplicate) {
  return duplicate.is_active === 1
    ? "Bu isimde bir binanız zaten var."
    : "Bu isimde silinmiş bir binanız var. Silinen binalar bölümünden geri getirebilir ya da farklı bir isim seçebilirsiniz.";
}

// Numbering runs bottom up and is plain 1..N, so the number stays short enough for the
// apartment_no CHECK no matter how many floors there are. The floor count covers the upper floors only, so a
// ground floor adds a level below them and the top floor keeps the number the user typed.
function layoutRows(layout) {
  const rows = [];
  const firstFloor = layout.groundFloor ? 0 : 1;
  const levels = layout.groundFloor ? layout.floors + 1 : layout.floors;

  for (let step = 0; step < levels; step += 1) {
    for (let index = 0; index < layout.perFloor; index += 1) {
      rows.push({ apartmentNo: String(rows.length + 1), floor: firstFloor + step });
    }
  }
  return rows;
}

// The layout is optional. When it is there the apartments are written in the same transaction as
// the building, so a half created building with no apartments cannot be left behind.
function createBuilding(payload) {
  const { name, layout } = payload;
  try {
    const db = getDb();

    // owner_id is still a NOT NULL column, so it is filled from the single account rather than the request.
    const owner = db.prepare(`SELECT id FROM users WHERE is_active = 1 ORDER BY id LIMIT 1`).get();
    if (!owner) return { success: false, message: "Hesap bulunamadı." };

    const duplicate = findDuplicateName(name);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const rows = layout ? layoutRows(layout) : [];

    const buildingId = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO buildings (owner_id, name, created_at, updated_at)
           VALUES (?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
        )
        .run(owner.id, name);

      const insertApartment = db.prepare(
        `INSERT INTO apartments (building_id, apartment_no, floor, type, due_amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      );
      for (const row of rows) {
        insertApartment.run(result.lastInsertRowid, row.apartmentNo, row.floor, layout.type, layout.dueAmount);
      }

      return result.lastInsertRowid;
    })();

    return { success: true, message: "Bina oluşturuldu.", id: buildingId, apartmentCount: rows.length };
  } catch (err) {
    console.error("[building.service] createBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina oluşturma") };
  }
}

function renameBuilding(payload) {
  const { buildingId, name } = payload;
  try {
    const duplicate = findDuplicateName(name, buildingId);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const result = getDb()
      .prepare(
        `UPDATE buildings SET name = ?, updated_at = ${TR_NOW_SQL}
         WHERE id = ? AND is_removed = 0`,
      )
      .run(name, buildingId);
    if (result.changes === 0) return { success: false, message: NOT_FOUND_MESSAGE };
    return { success: true, message: "Bina adı güncellendi." };
  } catch (err) {
    console.error("[building.service] renameBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina güncelleme") };
  }
}

// Archive and bring back. The UI calls these Sil and Geri Getir, so the messages use those words.
function updateBuildingStatus(payload) {
  const { buildingId, isActive } = payload;
  try {
    const result = getDb()
      .prepare(
        `UPDATE buildings SET is_active = ?, updated_at = ${TR_NOW_SQL}
         WHERE id = ? AND is_removed = 0`,
      )
      .run(isActive ? 1 : 0, buildingId);
    if (result.changes === 0) return { success: false, message: NOT_FOUND_MESSAGE };
    return { success: true, message: isActive ? "Bina geri getirildi." : "Bina silindi." };
  } catch (err) {
    console.error("[building.service] updateBuildingStatus:", err);
    return { success: false, message: resolveDbError(err, "Bina durumu güncelleme") };
  }
}

// Remove for good, which is still a soft delete. Only an archived building can get here.
function removeBuilding(payload) {
  const { buildingId } = payload;
  try {
    const building = getDb().prepare(`SELECT is_active FROM buildings WHERE id = ? AND is_removed = 0`).get(buildingId);
    if (!building) return { success: false, message: NOT_FOUND_MESSAGE };
    if (building.is_active === 1) {
      return {
        success: false,
        message: "Bina, kalıcı olarak silinmeden önce silinen binalar bölümüne taşınmalıdır.",
      };
    }

    getDb().prepare(`UPDATE buildings SET is_removed = 1, updated_at = ${TR_NOW_SQL} WHERE id = ?`).run(buildingId);
    return { success: true, message: "Bina kalıcı olarak silindi." };
  } catch (err) {
    console.error("[building.service] removeBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina kaldırma") };
  }
}

module.exports = { listBuildings, createBuilding, renameBuilding, updateBuildingStatus, removeBuilding };

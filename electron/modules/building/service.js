// Building rules. A building row is never deleted. is_active = 0 archives it, is_removed = 1
// removes it, and all five endpoints touch only rows with is_removed = 0.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL } = require("../shared/trTime");

const COLUMN_LABELS = {
  name: "Bina adı",
};

// One message for both cases, so it does not reveal whether the building belongs to someone else.
const NOT_FOUND_MESSAGE = "Bina bulunamadı veya bu işlem için yetkiniz yok.";

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// The two counts are subqueries rather than a second round trip, because the picker draws one
// meta line per building and a per-building call would be one IPC hop each. Both are scoped to
// active apartments, so the numbers match what the apartment and resident screens list.
// person_count sums household_size instead of counting rows, because one resident row stands for
// a whole household.
function listBuildings(payload) {
  try {
    const data = getDb()
      .prepare(
        `SELECT b.id, b.name, b.is_active,
                (SELECT COUNT(*) FROM apartments a
                  WHERE a.building_id = b.id AND a.is_active = 1) AS apartment_count,
                (SELECT COALESCE(SUM(r.household_size), 0) FROM residents r
                  JOIN apartments a ON a.id = r.apartment_id
                  WHERE a.building_id = b.id AND a.is_active = 1 AND r.is_active = 1) AS person_count
         FROM buildings b WHERE b.owner_id = ? AND b.is_removed = 0
         ORDER BY b.is_active DESC, b.name COLLATE NOCASE ASC`,
      )
      .all(payload.ownerId);
    return { success: true, data };
  } catch (err) {
    console.error("[building.service] listBuildings:", err);
    return { success: false, message: "Bina listesi alınamadı." };
  }
}

// Name check inside the account, ignoring upper and lower case. The partial unique index is the
// last line of defence.
function findDuplicateName(ownerId, name, excludeId = null) {
  return getDb()
    .prepare(
      `SELECT id, is_active FROM buildings
       WHERE owner_id = ? AND is_removed = 0 AND name = ? COLLATE NOCASE AND id IS NOT ?
       LIMIT 1`,
    )
    .get(ownerId, name, excludeId);
}

// The wording changes if the building with that name sits in the deleted section.
function duplicateNameMessage(duplicate) {
  return duplicate.is_active === 1
    ? "Bu isimde bir binanız zaten var."
    : "Bu isimde silinmiş bir binanız var. Silinen binalar bölümünden geri getirebilir ya da farklı bir isim seçebilirsiniz.";
}

function createBuilding(payload) {
  const { ownerId, name } = payload;
  try {
    const owner = getDb().prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1`).get(ownerId);
    if (!owner) return { success: false, message: "Hesap bulunamadı." };

    const duplicate = findDuplicateName(ownerId, name);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const result = getDb()
      .prepare(
        `INSERT INTO buildings (owner_id, name, created_at, updated_at)
         VALUES (?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(ownerId, name);
    return { success: true, message: "Bina oluşturuldu.", id: result.lastInsertRowid };
  } catch (err) {
    console.error("[building.service] createBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina oluşturma") };
  }
}

function renameBuilding(payload) {
  const { buildingId, ownerId, name } = payload;
  try {
    const duplicate = findDuplicateName(ownerId, name, buildingId);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const result = getDb()
      .prepare(
        `UPDATE buildings SET name = ?, updated_at = ${TR_NOW_SQL}
         WHERE id = ? AND owner_id = ? AND is_removed = 0`,
      )
      .run(name, buildingId, ownerId);
    if (result.changes === 0) return { success: false, message: NOT_FOUND_MESSAGE };
    return { success: true, message: "Bina adı güncellendi." };
  } catch (err) {
    console.error("[building.service] renameBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina güncelleme") };
  }
}

// Archive and bring back. The UI calls these Sil and Geri Getir, so the messages use those words.
function updateBuildingStatus(payload) {
  const { buildingId, ownerId, isActive } = payload;
  try {
    const result = getDb()
      .prepare(
        `UPDATE buildings SET is_active = ?, updated_at = ${TR_NOW_SQL}
         WHERE id = ? AND owner_id = ? AND is_removed = 0`,
      )
      .run(isActive ? 1 : 0, buildingId, ownerId);
    if (result.changes === 0) return { success: false, message: NOT_FOUND_MESSAGE };
    return { success: true, message: isActive ? "Bina geri getirildi." : "Bina silindi." };
  } catch (err) {
    console.error("[building.service] updateBuildingStatus:", err);
    return { success: false, message: resolveDbError(err, "Bina durumu güncelleme") };
  }
}

// Remove for good, which is still a soft delete. Only an archived building can get here.
function removeBuilding(payload) {
  const { buildingId, ownerId } = payload;
  try {
    const building = getDb()
      .prepare(`SELECT is_active FROM buildings WHERE id = ? AND owner_id = ? AND is_removed = 0`)
      .get(buildingId, ownerId);
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

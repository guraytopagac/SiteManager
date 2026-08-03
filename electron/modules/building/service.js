const { db } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const COLUMN_LABELS = {
  name: "Bina adı",
  owner_id: "Hesap",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function listBuildings(ownerId) {
  try {
    const data = db
      .prepare(
        `SELECT id, name, is_active, created_at
         FROM buildings WHERE owner_id = ? AND is_removed = 0
         ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
      )
      .all(ownerId);
    return { success: true, data };
  } catch (err) {
    console.error("[building.service] listBuildings:", err);
    return { success: false, message: "Bina listesi alınamadı." };
  }
}

function findDuplicateName(ownerId, name, excludeId = null) {
  return db
    .prepare(
      `SELECT id, is_active FROM buildings
       WHERE owner_id = ? AND is_removed = 0 AND name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)
       LIMIT 1`,
    )
    .get(ownerId, name, excludeId, excludeId);
}

function duplicateNameMessage(duplicate) {
  return duplicate.is_active === 1
    ? "Bu isimde bir binanız zaten var."
    : "Bu isimde arşivlenmiş bir binanız var. Arşivden geri getirebilir ya da farklı bir isim seçebilirsiniz.";
}

function createBuilding(ownerId, name) {
  try {
    const owner = db.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1`).get(ownerId);
    if (!owner) return { success: false, message: "Hesap bulunamadı." };

    const duplicate = findDuplicateName(ownerId, name);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const result = db
      .prepare(
        `INSERT INTO buildings (owner_id, name, created_at, updated_at)
         VALUES (?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
      )
      .run(ownerId, name);
    return { success: true, message: "Bina oluşturuldu.", id: result.lastInsertRowid };
  } catch (err) {
    console.error("[building.service] createBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina oluşturma") };
  }
}

function renameBuilding(buildingId, ownerId, name) {
  try {
    const duplicate = findDuplicateName(ownerId, name, buildingId);
    if (duplicate) return { success: false, message: duplicateNameMessage(duplicate) };

    const result = db
      .prepare(
        `UPDATE buildings SET name = ?, updated_at = datetime('now', '+3 hours')
         WHERE id = ? AND owner_id = ?`,
      )
      .run(name, buildingId, ownerId);
    if (result.changes === 0) return { success: false, message: "Bina bulunamadı veya bu işlem için yetkiniz yok." };
    return { success: true, message: "Bina adı güncellendi." };
  } catch (err) {
    console.error("[building.service] renameBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina güncelleme") };
  }
}

function updateBuildingStatus(buildingId, ownerId, isActive) {
  try {
    const result = db
      .prepare(
        `UPDATE buildings SET is_active = ?, updated_at = datetime('now', '+3 hours')
         WHERE id = ? AND owner_id = ?`,
      )
      .run(isActive ? 1 : 0, buildingId, ownerId);
    if (result.changes === 0) return { success: false, message: "Bina bulunamadı veya bu işlem için yetkiniz yok." };
    const msg = isActive ? "Bina arşivden çıkarıldı." : "Bina arşivlendi.";
    return { success: true, message: msg };
  } catch (err) {
    console.error("[building.service] updateBuildingStatus:", err);
    return { success: false, message: resolveDbError(err, "Bina durumu güncelleme") };
  }
}

function removeBuilding(buildingId, ownerId) {
  try {
    const result = db
      .prepare(
        `UPDATE buildings SET is_removed = 1, updated_at = datetime('now', '+3 hours')
         WHERE id = ? AND owner_id = ? AND is_active = 0 AND is_removed = 0`,
      )
      .run(buildingId, ownerId);
    if (result.changes === 0) {
      return { success: false, message: "Bina bulunamadı veya bu işlem için yetkiniz yok." };
    }
    return { success: true, message: "Bina kalıcı olarak silindi." };
  } catch (err) {
    console.error("[building.service] removeBuilding:", err);
    return { success: false, message: resolveDbError(err, "Bina kaldırma") };
  }
}

module.exports = { listBuildings, createBuilding, renameBuilding, updateBuildingStatus, removeBuilding };

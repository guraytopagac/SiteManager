const db = require("../../database/db");

function addApartment(data) {
  try {
    db.prepare(
      `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id,
                               resident_name, resident_phone, resident_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.apartment_no,
      data.floor,
      data.type,
      data.square_meters,
      data.due_amount,
      data.manager_id,
      data.resident_name || null,
      data.resident_phone || null,
      data.resident_email || null,
    );
    return { success: true, message: "Daire eklendi." };
  } catch {
    return { success: false, message: "Daire eklenemedi. Daire numarası benzersiz olmalıdır." };
  }
}

function getApartments(userId) {
  try {
    const data = db.prepare(`SELECT * FROM apartments WHERE manager_id = ?`).all(userId);
    return { success: true, data };
  } catch {
    return { success: false, message: "Veriler alınamadı." };
  }
}

function updateApartment(id, data) {
  try {
    const result = db
      .prepare(
        `UPDATE apartments
         SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?,
             resident_name = ?, resident_phone = ?, resident_email = ?
         WHERE id = ?`,
      )
      .run(
        data.apartment_no,
        data.floor,
        data.type,
        data.square_meters,
        data.due_amount,
        data.resident_name || null,
        data.resident_phone || null,
        data.resident_email || null,
        id,
      );
    if (result.changes === 0) return { success: false, message: "Daire bulunamadı." };
    return { success: true, message: "Daire başarıyla güncellendi." };
  } catch {
    return { success: false, message: "Daire güncellenemedi. Daire numarası benzersiz olmalıdır." };
  }
}

function deleteApartment(id) {
  try {
    const result = db.prepare(`DELETE FROM apartments WHERE id = ?`).run(id);
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

module.exports = { addApartment, getApartments, updateApartment, deleteApartment, bulkUpdateDueAmount };

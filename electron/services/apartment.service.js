const db = require("../../database/db");

function addApartment(data) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id,
                              resident_name, resident_phone, resident_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        data.apartment_no,
        data.floor,
        data.type,
        data.square_meters,
        data.due_amount,
        data.manager_id,
        data.resident_name || null,
        data.resident_phone || null,
        data.resident_email || null,
      ],
      function (err) {
        if (err) return resolve({ success: false, message: "Daire eklenemedi. Daire numarası benzersiz olmalıdır." });
        resolve({ success: true, message: "Daire eklendi." });
      },
    );
  });
}

function getApartments(userId) {
  return new Promise((resolve) => {
    db.all("SELECT * FROM apartments WHERE manager_id = ?", [userId], (err, rows) => {
      if (err) return resolve({ success: false, message: "Veriler alınamadı." });
      resolve({ success: true, data: rows });
    });
  });
}

function updateApartment(id, data) {
  return new Promise((resolve) => {
    const query = `
      UPDATE apartments
      SET apartment_no = ?, floor = ?, type = ?, square_meters = ?, due_amount = ?,
          resident_name = ?, resident_phone = ?, resident_email = ?
      WHERE id = ?
    `;
    db.run(
      query,
      [
        data.apartment_no,
        data.floor,
        data.type,
        data.square_meters,
        data.due_amount,
        data.resident_name || null,
        data.resident_phone || null,
        data.resident_email || null,
        id,
      ],
      function (err) {
        if (err)
          return resolve({ success: false, message: "Daire güncellenemedi. Daire numarası benzersiz olmalıdır." });
        if (this.changes === 0) return resolve({ success: false, message: "Daire bulunamadı." });
        resolve({ success: true, message: "Daire başarıyla güncellendi." });
      },
    );
  });
}

function deleteApartment(id) {
  return new Promise((resolve) => {
    db.run("DELETE FROM apartments WHERE id = ?", [id], function (err) {
      if (err) return resolve({ success: false, message: "Daire silinemedi." });
      if (this.changes === 0) return resolve({ success: false, message: "Daire bulunamadı." });
      resolve({ success: true, message: "Daire ve ilgili tüm aidat kayıtları silindi." });
    });
  });
}

module.exports = { addApartment, getApartments, updateApartment, deleteApartment };

const db = require('../../database/db');

function addApartment(data) {
    return new Promise((resolve) => {
        const query = `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount, manager_id) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(query, [data.apartment_no, data.floor, data.type, data.square_meters, data.due_amount, data.manager_id], function (err) {
            if (err) return resolve({ success: false, message: "Daire eklenemedi. Lütfen hakkında kısmından bilgi alınız." });

            resolve({ success: true, message: "Daire eklendi." });
        });
    });
}

function getApartments(userId) {
    return new Promise((resolve) => {
        db.all("SELECT * FROM apartments WHERE manager_id = ?", [userId], (err, rows) => {
            if (err) {
                resolve({ success: false, message: "Veriler alınamadı." });
            } else {
                resolve({ success: true, data: rows });
            }
        });
    });
}

module.exports = { addApartment, getApartments };

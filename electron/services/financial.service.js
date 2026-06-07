const db = require("../../database/db");

function addIncome(data) {
  return new Promise((resolve) => {
    const recordDate = data.date || new Date().toISOString().split("T")[0];

    const query = `INSERT INTO incomes (amount, date, description, manager_id) VALUES (?, ?, ?, ?)`;

    db.run(query, [data.amount, recordDate, data.description, data.manager_id], function (err) {
      if (err) {
        console.error("Error adding income:", err);
        resolve({
          success: false,
          message: "Gelir eklenirken bir veri tabanı hatası oluştu.",
        });
      } else {
        resolve({
          success: true,
          id: this.lastID,
          message: "Gelir kaydı başarıyla eklendi.",
        });
      }
    });
  });
}

function addExpense(data) {
  return new Promise((resolve) => {
    const recordDate = data.date || new Date().toISOString().split("T")[0];

    const query = `INSERT INTO expenses (amount, date, description, manager_id) VALUES (?, ?, ?, ?)`;

    db.run(query, [data.amount, recordDate, data.description, data.manager_id], function (err) {
      if (err) {
        console.error("Error adding expense:", err);
        resolve({
          success: false,
          message: "Gider eklenirken bir veri tabanı hatası oluştu.",
        });
      } else {
        resolve({
          success: true,
          id: this.lastID,
          message: "Gider kaydı başarıyla eklendi.",
        });
      }
    });
  });
}

module.exports = { addIncome, addExpense };

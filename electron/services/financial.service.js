const db = require("../../database/db");

function addIncome(data) {
  try {
    const recordDate = data.date || new Date().toISOString().split("T")[0];
    const result = db
      .prepare(`INSERT INTO incomes (amount, date, description, manager_id) VALUES (?, ?, ?, ?)`)
      .run(data.amount, recordDate, data.description, data.manager_id);
    return { success: true, id: result.lastInsertRowid, message: "Gelir kaydı başarıyla eklendi." };
  } catch {
    return { success: false, message: "Gelir eklenirken bir veri tabanı hatası oluştu." };
  }
}

function addExpense(data) {
  try {
    const recordDate = data.date || new Date().toISOString().split("T")[0];
    const result = db
      .prepare(`INSERT INTO expenses (amount, date, description, manager_id) VALUES (?, ?, ?, ?)`)
      .run(data.amount, recordDate, data.description, data.manager_id);
    return { success: true, id: result.lastInsertRowid, message: "Gider kaydı başarıyla eklendi." };
  } catch {
    return { success: false, message: "Gider eklenirken bir veri tabanı hatası oluştu." };
  }
}

function getTransactions(managerId) {
  try {
    const data = db
      .prepare(
        `SELECT id, amount, date, description, 'income' AS type FROM incomes WHERE manager_id = ?
         UNION ALL
         SELECT id, amount, date, description, 'expense' AS type FROM expenses WHERE manager_id = ?
         ORDER BY date DESC, id DESC`,
      )
      .all(managerId, managerId);
    return { success: true, data };
  } catch {
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

module.exports = { addIncome, addExpense, getTransactions };

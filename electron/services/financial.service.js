const db = require("../../database/db");

const ALLOWED_TABLES = new Set(["incomes", "expenses"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function insertRecord(table, data, label) {
  if (!ALLOWED_TABLES.has(table)) {
    return { success: false, message: "Geçersiz işlem türü." };
  }
  if (!data.manager_id) {
    return { success: false, message: "Yetkisiz işlem." };
  }
  const amount = parseFloat(data.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return { success: false, message: "Geçersiz tutar." };
  }
  if (data.date && !ISO_DATE.test(data.date)) {
    return { success: false, message: "Geçersiz tarih formatı." };
  }

  const recordDate = data.date || new Date().toISOString().split("T")[0];
  const description = data.description?.trim() || "";
  const result = db
    .prepare(`INSERT INTO ${table} (amount, date, description, manager_id) VALUES (?, ?, ?, ?)`)
    .run(amount, recordDate, description, data.manager_id);
  return { success: true, id: result.lastInsertRowid, message: `${label} başarıyla eklendi.` };
}

function addIncome(data) {
  try {
    return insertRecord("incomes", data, "Gelir kaydı");
  } catch (err) {
    console.error("[financial] addIncome:", err);
    return { success: false, message: "Gelir eklenirken bir veri tabanı hatası oluştu." };
  }
}

function addExpense(data) {
  try {
    return insertRecord("expenses", data, "Gider kaydı");
  } catch (err) {
    console.error("[financial] addExpense:", err);
    return { success: false, message: "Gider eklenirken bir veri tabanı hatası oluştu." };
  }
}

function getTransactions(managerId, { startDate, endDate } = {}) {
  try {
    if (startDate && !ISO_DATE.test(startDate)) {
      return { success: false, message: "Geçersiz başlangıç tarihi." };
    }
    if (endDate && !ISO_DATE.test(endDate)) {
      return { success: false, message: "Geçersiz bitiş tarihi." };
    }
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return { success: false, message: "Tarih aralığı için başlangıç ve bitiş tarihi gerekli." };
    }

    let dateFilter = "";
    let params = [managerId, managerId];

    if (startDate && endDate) {
      dateFilter = "AND date BETWEEN ? AND ?";
      params = [managerId, startDate, endDate, managerId, startDate, endDate];
    }

    const data = db
      .prepare(
        `SELECT id, amount, date, description, 'income' AS type FROM incomes WHERE manager_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, description, 'expense' AS type FROM expenses WHERE manager_id = ? ${dateFilter}
         ORDER BY date DESC, id DESC`,
      )
      .all(...params);
    return { success: true, data };
  } catch (err) {
    console.error("[financial] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

module.exports = { addIncome, addExpense, getTransactions };

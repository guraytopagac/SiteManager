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
  if (!description) return { success: false, message: "Açıklama alanı zorunludur." };
  const category = data.category?.trim() || "other";
  const result = db
    .prepare(`INSERT INTO ${table} (amount, date, description, category, manager_id) VALUES (?, ?, ?, ?, ?)`)
    .run(amount, recordDate, description, category, data.manager_id);
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
        `SELECT id, amount, date, description, category, 'income' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM incomes WHERE manager_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, description, category, 'expense' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM expenses WHERE manager_id = ? ${dateFilter}
         ORDER BY date DESC, id DESC`,
      )
      .all(...params);
    return { success: true, data };
  } catch (err) {
    console.error("[financial] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

function cancelRecord(table, id, managerId, reason, cancelledBy) {
  if (!ALLOWED_TABLES.has(table)) return { success: false, message: "Geçersiz işlem türü." };

  const record = db.prepare(`SELECT id, is_cancelled${table === "incomes" ? ", due_payment_id" : ""} FROM ${table} WHERE id = ? AND manager_id = ?`).get(id, managerId);
  if (!record) return { success: false, message: "Kayıt bulunamadı." };
  if (record.is_cancelled) return { success: false, message: "Bu kayıt zaten iptal edilmiş." };
  if (table === "incomes" && record.due_payment_id != null) {
    return { success: false, message: "Aidat ödemesine bağlı gelirler yalnızca ödeme iptali üzerinden iptal edilebilir." };
  }

  db.prepare(
    `UPDATE ${table} SET is_cancelled = 1, cancelled_at = datetime('now'), cancel_reason = ?, cancelled_by = ?,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(reason, cancelledBy, id);

  return { success: true, message: "Kayıt başarıyla iptal edildi." };
}

function cancelIncome(id, managerId, reason, cancelledBy) {
  try {
    return cancelRecord("incomes", id, managerId, reason, cancelledBy);
  } catch (err) {
    console.error("[financial] cancelIncome:", err);
    return { success: false, message: "Gelir iptal edilirken bir hata oluştu." };
  }
}

function cancelExpense(id, managerId, reason, cancelledBy) {
  try {
    return cancelRecord("expenses", id, managerId, reason, cancelledBy);
  } catch (err) {
    console.error("[financial] cancelExpense:", err);
    return { success: false, message: "Gider iptal edilirken bir hata oluştu." };
  }
}

module.exports = { addIncome, addExpense, getTransactions, cancelIncome, cancelExpense };

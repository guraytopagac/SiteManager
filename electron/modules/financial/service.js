const { db } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const ALLOWED_TABLES = new Set(["incomes", "expenses"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const COLUMN_LABELS = {
  amount: "Tutar",
  date: "Tarih",
  description: "Açıklama",
  category: "Kategori",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function insertRecord(table, recordData, label) {
  if (!ALLOWED_TABLES.has(table)) {
    return { success: false, message: "Geçersiz işlem türü." };
  }
  if (!recordData.buildingId) {
    return { success: false, message: "Yetkisiz işlem." };
  }
  const amount = recordData.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: "Geçersiz tutar." };
  }
  if (recordData.date && !ISO_DATE.test(recordData.date)) {
    return { success: false, message: "Geçersiz tarih formatı." };
  }

  const recordDate = recordData.date || new Date(Date.now() + 3 * 3600 * 1000).toISOString().split("T")[0];
  const description = recordData.description || "";
  if (!description) return { success: false, message: "Açıklama alanı zorunludur." };
  const category = recordData.category || "other";
  const result = db
    .prepare(
      `INSERT INTO ${table} (amount, date, description, category, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
    )
    .run(amount, recordDate, description, category, recordData.buildingId);
  return { success: true, id: result.lastInsertRowid, message: `${label} başarıyla eklendi.` };
}

function addIncome(incomeData) {
  try {
    return insertRecord("incomes", incomeData, "Gelir kaydı");
  } catch (err) {
    console.error("[financial.service] addIncome:", err);
    return { success: false, message: resolveDbError(err, "Gelir ekleme") };
  }
}

function addExpense(expenseData) {
  try {
    return insertRecord("expenses", expenseData, "Gider kaydı");
  } catch (err) {
    console.error("[financial.service] addExpense:", err);
    return { success: false, message: resolveDbError(err, "Gider ekleme") };
  }
}

function getTransactions(buildingId) {
  try {
    const transactions = db
      .prepare(
        `SELECT id, amount, date, description, category, 'income' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM incomes WHERE building_id = ?
         UNION ALL
         SELECT id, amount, date, description, category, 'expense' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM expenses WHERE building_id = ?
         ORDER BY date DESC, id DESC`,
      )
      .all(buildingId, buildingId);
    return { success: true, data: transactions };
  } catch (err) {
    console.error("[financial.service] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

function cancelRecord(table, id, buildingId, userId, reason) {
  if (!ALLOWED_TABLES.has(table)) return { success: false, message: "Geçersiz işlem türü." };

  const record = db
    .prepare(
      `SELECT id, is_cancelled${table === "incomes" ? ", due_payment_id" : ""} FROM ${table} WHERE id = ? AND building_id = ?`,
    )
    .get(id, buildingId);
  if (!record) return { success: false, message: "Kayıt bulunamadı." };
  if (record.is_cancelled) return { success: false, message: "Bu kayıt zaten iptal edilmiş." };
  if (table === "incomes" && record.due_payment_id != null) {
    return {
      success: false,
      message: "Aidat ödemesine bağlı gelirler yalnızca ödeme iptali üzerinden iptal edilebilir.",
    };
  }

  db.prepare(
    `UPDATE ${table} SET is_cancelled = 1, cancelled_at = datetime('now', '+3 hours'), cancel_reason = ?, cancelled_by = ?,
     updated_at = datetime('now', '+3 hours') WHERE id = ?`,
  ).run(reason, userId, id);

  return { success: true, message: "Kayıt başarıyla iptal edildi." };
}

function cancelIncome(id, buildingId, userId, reason) {
  try {
    return cancelRecord("incomes", id, buildingId, userId, reason);
  } catch (err) {
    console.error("[financial.service] cancelIncome:", err);
    return { success: false, message: resolveDbError(err, "Gelir iptali") };
  }
}

function cancelExpense(id, buildingId, userId, reason) {
  try {
    return cancelRecord("expenses", id, buildingId, userId, reason);
  } catch (err) {
    console.error("[financial.service] cancelExpense:", err);
    return { success: false, message: resolveDbError(err, "Gider iptali") };
  }
}

module.exports = { addIncome, addExpense, getTransactions, cancelIncome, cancelExpense };

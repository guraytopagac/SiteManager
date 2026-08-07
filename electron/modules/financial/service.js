const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const ALLOWED_TABLES = new Set(["incomes", "expenses"]);

const COLUMN_LABELS = {
  amount: "Tutar",
  date: "Tarih",
  description: "Açıklama",
  category: "Kategori",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function insertRecord(table, recordData, label) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`insertRecord: table not allowed: ${table}`);

  const category = recordData.category || "other";
  const result = getDb()
    .prepare(
      `INSERT INTO ${table} (amount, date, description, category, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
    )
    .run(recordData.amount, recordData.date, recordData.description, category, recordData.buildingId);
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

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

function getTransactions(buildingId, period) {
  try {
    const hasPeriod = period && Number.isInteger(period.year) && Number.isInteger(period.month);
    const dateFilter = hasPeriod ? "AND date >= ? AND date < ?" : "";

    const params = [buildingId];
    if (hasPeriod) {
      const { start, end } = monthBounds(period.year, period.month);
      params.push(start, end);
    }

    const transactions = getDb()
      .prepare(
        `SELECT id, amount, date, description, category, 'income' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM incomes WHERE building_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, description, category, 'expense' AS type,
                is_cancelled, cancelled_at, cancel_reason FROM expenses WHERE building_id = ? ${dateFilter}
         ORDER BY date DESC, id DESC`,
      )
      .all(...params, ...params);
    return { success: true, data: transactions };
  } catch (err) {
    console.error("[financial.service] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

function cancelRecord(table, id, buildingId, userId, reason) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`cancelRecord: table not allowed: ${table}`);

  const record = getDb()
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

  getDb().prepare(
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

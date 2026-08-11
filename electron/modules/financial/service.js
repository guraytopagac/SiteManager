const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { assertFinancialTable } = require("../shared/tables");
const { TR_NOW_SQL, monthBounds } = require("../shared/trTime");

const COLUMN_LABELS = {
  amount: "Tutar",
  date: "Tarih",
  description: "Açıklama",
  category: "Kategori",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function insertRecord(table, payload, label) {
  assertFinancialTable(table, "insertRecord");

  const result = getDb()
    .prepare(
      `INSERT INTO ${table} (amount, date, description, category, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
    )
    .run(payload.amount, payload.date, payload.description, payload.category || "other", payload.buildingId);
  return { success: true, id: result.lastInsertRowid, message: `${label} başarıyla eklendi.` };
}

function addIncome(payload) {
  try {
    return insertRecord("incomes", payload, "Gelir kaydı");
  } catch (err) {
    console.error("[financial.service] addIncome:", err);
    return { success: false, message: resolveDbError(err, "Gelir ekleme") };
  }
}

function addExpense(payload) {
  try {
    return insertRecord("expenses", payload, "Gider kaydı");
  } catch (err) {
    console.error("[financial.service] addExpense:", err);
    return { success: false, message: resolveDbError(err, "Gider ekleme") };
  }
}

function getTransactions(payload) {
  const { buildingId, period } = payload;
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

function cancelRecord(table, payload) {
  assertFinancialTable(table, "cancelRecord");

  const { id, buildingId, userId, reason } = payload;
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

  getDb()
    .prepare(
      `UPDATE ${table} SET is_cancelled = 1, cancelled_at = ${TR_NOW_SQL}, cancel_reason = ?, cancelled_by = ?,
       updated_at = ${TR_NOW_SQL} WHERE id = ?`,
    )
    .run(reason, userId, id);

  return { success: true, message: "Kayıt başarıyla iptal edildi." };
}

function cancelIncome(payload) {
  try {
    return cancelRecord("incomes", payload);
  } catch (err) {
    console.error("[financial.service] cancelIncome:", err);
    return { success: false, message: resolveDbError(err, "Gelir iptali") };
  }
}

function cancelExpense(payload) {
  try {
    return cancelRecord("expenses", payload);
  } catch (err) {
    console.error("[financial.service] cancelExpense:", err);
    return { success: false, message: resolveDbError(err, "Gider iptali") };
  }
}

module.exports = { addIncome, addExpense, getTransactions, cancelIncome, cancelExpense };

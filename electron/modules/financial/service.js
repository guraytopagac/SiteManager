// Income and expense rules. A record is never deleted, only cancelled.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL, monthBounds } = require("../shared/trTime");

const COLUMN_LABELS = {
  amount: "Tutar",
  date: "Tarih",
  description: "Açıklama",
  category: "Kategori",
};

// Only incomes have the dues link, so the two tables read different columns before cancelling.
const CANCEL_SELECT = {
  incomes: "is_cancelled, due_payment_id",
  expenses: "is_cancelled",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// Income and expense run the same code over two tables, so the try/catch sits here once.
function withDbError(name, context, run) {
  return (payload) => {
    try {
      return run(payload);
    } catch (err) {
      console.error(`[financial.service] ${name}:`, err);
      return { success: false, message: resolveDbError(err, context) };
    }
  };
}

// The table name goes straight into the SQL, so it may only come from a fixed string in this file.
function insertRecord(table, payload, label) {
  const result = getDb()
    .prepare(
      `INSERT INTO ${table} (amount, date, description, category, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
    )
    .run(payload.amount, payload.date, payload.description, payload.category, payload.buildingId);
  return { success: true, id: result.lastInsertRowid, message: `${label} eklendi.` };
}

// Soft cancel. An income tied to a dues payment can only be cancelled through cancelPayment.
function cancelRecord(table, payload, label) {
  const { id, buildingId, userId, reason } = payload;
  const record = getDb()
    .prepare(`SELECT ${CANCEL_SELECT[table]} FROM ${table} WHERE id = ? AND building_id = ?`)
    .get(id, buildingId);
  if (!record) return { success: false, message: "Kayıt bulunamadı." };
  if (record.is_cancelled) return { success: false, message: "Bu kayıt zaten iptal edilmiş." };
  if (record.due_payment_id != null) {
    return {
      success: false,
      message: "Aidat ödemesine bağlı gelirler yalnızca ödeme iptali üzerinden iptal edilebilir.",
    };
  }

  getDb()
    .prepare(
      `UPDATE ${table} SET is_cancelled = 1, cancelled_at = ${TR_NOW_SQL}, cancel_reason = ?, cancelled_by = ?,
       updated_at = ${TR_NOW_SQL} WHERE id = ? AND building_id = ?`,
    )
    .run(reason, userId, id, buildingId);

  return { success: true, message: `${label} iptal edildi.` };
}

// Income and expense in one list, newest first. A null period means all time. The totals skip
// cancelled rows and are worked out in SQL, not in the renderer.
function getTransactions(payload) {
  const { buildingId, period } = payload;
  try {
    const hasPeriod = Boolean(period);
    const dateFilter = hasPeriod ? "AND date >= ? AND date < ?" : "";

    // The same parameters are passed twice, once for each half of the UNION.
    const params = [buildingId];
    if (hasPeriod) {
      const { start, end } = monthBounds(period.year, period.month);
      params.push(start, end);
    }

    const transactions = getDb()
      .prepare(
        `SELECT id, amount, date, description, category, 'income' AS type, created_at,
                is_cancelled, cancelled_at, cancel_reason FROM incomes WHERE building_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, description, category, 'expense' AS type, created_at,
                is_cancelled, cancelled_at, cancel_reason FROM expenses WHERE building_id = ? ${dateFilter}
         ORDER BY date DESC, created_at DESC, id DESC`,
      )
      .all(...params, ...params);

    const { totalIncome, totalExpense } = getDb()
      .prepare(
        `SELECT
           (SELECT COALESCE(SUM(amount), 0) FROM incomes
             WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}) AS totalIncome,
           (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}) AS totalExpense`,
      )
      .get(...params, ...params);

    return {
      success: true,
      data: transactions,
      totals: { totalIncome, totalExpense, net: totalIncome - totalExpense },
    };
  } catch (err) {
    console.error("[financial.service] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

const addIncome = withDbError("addIncome", "Gelir ekleme", (payload) =>
  insertRecord("incomes", payload, "Gelir kaydı"),
);
const addExpense = withDbError("addExpense", "Gider ekleme", (payload) =>
  insertRecord("expenses", payload, "Gider kaydı"),
);
const cancelIncome = withDbError("cancelIncome", "Gelir iptali", (payload) =>
  cancelRecord("incomes", payload, "Gelir kaydı"),
);
const cancelExpense = withDbError("cancelExpense", "Gider iptali", (payload) =>
  cancelRecord("expenses", payload, "Gider kaydı"),
);

module.exports = { addIncome, addExpense, getTransactions, cancelIncome, cancelExpense };

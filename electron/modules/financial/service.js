// Income and expense rules. A record is never deleted, only cancelled.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { periodCutoff, RESIDENT_NAME_FOR_PERIOD_SQL } = require("../shared/residentPeriod");
const { ensureSeveranceTransfers } = require("../shared/severanceFund");
const { TR_NOW_SQL, monthBounds } = require("../shared/trTime");

// Only NOT NULL columns belong here, since the resolver reads a label on the UNIQUE and NOT NULL branches
// alone. The nullable columns can only fail a CHECK, which carries no usable column name.
const COLUMN_LABELS = {
  amount: "Tutar",
  date: "Tarih",
  category: "Kategori",
};

// Only incomes have the dues link and only expenses carry the severance transfers, so the two tables
// read different columns before cancelling.
const CANCEL_SELECT = {
  incomes: "is_cancelled, due_payment_id",
  expenses: "is_cancelled, category",
};

// Columns only one table takes on insert. The names are fixed here and each value is read from the
// validated payload under the same key, so nothing from the renderer reaches the SQL text.
const EXTRA_INSERT_COLUMNS = {
  incomes: ["payment_method"],
  expenses: [],
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
  const extraColumns = EXTRA_INSERT_COLUMNS[table];
  const extraNames = extraColumns.map((column) => `${column}, `).join("");
  const extraSlots = extraColumns.map(() => "?, ").join("");
  const result = getDb()
    .prepare(
      `INSERT INTO ${table} (amount, date, description, category, building_id, ${extraNames}created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${extraSlots}${TR_NOW_SQL}, ${TR_NOW_SQL})`,
    )
    .run(
      payload.amount,
      payload.date,
      payload.description,
      payload.category,
      payload.buildingId,
      ...extraColumns.map((column) => payload[column]),
    );
  return { success: true, id: result.lastInsertRowid, message: `${label} eklendi.` };
}

// Soft cancel. An income tied to a dues payment can only be cancelled through cancelPayment, and a
// severance transfer only through the severance module.
function cancelRecord(table, payload, label) {
  const { id, buildingId, userId, reason } = payload;
  const record = getDb()
    .prepare(`SELECT ${CANCEL_SELECT[table]} FROM ${table} WHERE id = ? AND building_id = ?`)
    .get(id, buildingId);
  if (!record) return { success: false, message: "Kayıt bulunamadı." };
  if (record.is_cancelled) return { success: false, message: "Bu kayıt zaten iptal edilmiş." };
  if (record.category === "severance_fund") {
    return { success: false, message: "Tazminat kasası aktarımları bu sayfadan iptal edilemez." };
  }
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
// cancelled rows and are worked out in SQL, not in the renderer. Severance payouts are listed too, as
// their own type, and never counted: the main cash already paid for them through the fund transfers.
function getTransactions(payload) {
  const { buildingId, period } = payload;
  try {
    // The monthly fund transfer is an expense, so it is written before the list is read.
    ensureSeveranceTransfers(buildingId);

    const hasPeriod = Boolean(period);
    const dateFilter = hasPeriod ? "AND date >= ? AND date < ?" : "";

    const params = [buildingId];
    if (hasPeriod) {
      const { start, end } = monthBounds(period.year, period.month);
      params.push(start, end);
    }

    // A payout and its top-up are written in the same second, so sort_rank puts the payout above it, the same
    // order the fund page uses. A compound select can only sort by result columns, hence the extra column.
    const transactions = getDb()
      .prepare(
        `SELECT id, amount, date, description, category, 'income' AS type, created_at,
                is_cancelled, cancelled_at, cancel_reason, 0 AS sort_rank
         FROM incomes WHERE building_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, description, category, 'expense' AS type, created_at,
                is_cancelled, cancelled_at, cancel_reason, 0 AS sort_rank
         FROM expenses WHERE building_id = ? ${dateFilter}
         UNION ALL
         SELECT id, amount, date, full_name AS description, 'severance_payout' AS category, 'severance_payout' AS type,
                created_at, is_cancelled, cancelled_at, cancel_reason, 1 AS sort_rank
         FROM (SELECT p.*, e.full_name FROM severance_payouts p JOIN employees e ON e.id = p.employee_id)
         WHERE building_id = ? ${dateFilter}
         ORDER BY date DESC, created_at DESC, sort_rank DESC, id DESC`,
      )
      .all(...params, ...params, ...params);

    const { totalIncome, totalExpense } = getDb()
      .prepare(
        `SELECT
           (SELECT COALESCE(SUM(amount), 0) FROM incomes
             WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}) AS totalIncome,
           (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}) AS totalExpense`,
      )
      .get(...params, ...params);

    // The building's earliest record, so the renderer can tell "no records at all" from "nothing yet in the
    // month being viewed". Each half takes its own MIN, so the building_id + date index answers it.
    const start = getDb()
      .prepare(
        `SELECT CAST(strftime('%Y', MIN(first_date)) AS INTEGER) AS year,
                CAST(strftime('%m', MIN(first_date)) AS INTEGER) AS month
         FROM (SELECT MIN(date) AS first_date FROM incomes WHERE building_id = ?
               UNION ALL
               SELECT MIN(date) AS first_date FROM expenses WHERE building_id = ?)`,
      )
      .get(buildingId, buildingId);

    return {
      success: true,
      data: transactions,
      start: start.year === null ? null : start,
      totals: { totalIncome, totalExpense, net: totalIncome - totalExpense },
    };
  } catch (err) {
    console.error("[financial.service] getTransactions:", err);
    return { success: false, message: "İşlem geçmişi alınamadı." };
  }
}

function documentBlocker(record) {
  if (!record) return { success: false, message: "Kayıt bulunamadı." };
  if (record.is_cancelled) {
    return { success: false, message: "İptal edilmiş bir kayıt için belge oluşturulamaz." };
  }
  // A fund transfer moves money between the building's own two cash boxes, so there is no vendor to print.
  if (record.category === "severance_fund") {
    return { success: false, message: "Tazminat kasası aktarımı için gider pusulası oluşturulamaz." };
  }
  return null;
}

// The resident of the paid month rather than today's, so a receipt printed later still names the
// person who lived there then.
function residentNameForPaidMonth(receipt) {
  if (receipt.apartment_id == null) return null;
  const cutoff = periodCutoff(receipt.year, receipt.month);
  return getDb()
    .prepare(`SELECT ${RESIDENT_NAME_FOR_PERIOD_SQL} AS full_name FROM apartments a WHERE a.id = ?`)
    .get(cutoff, cutoff, receipt.apartment_id).full_name;
}

// One row per payment method, summed over the month's live payments. Cancelled payments are left out,
// since their income rows are cancelled with them.
function livePaymentsForDue(dueId) {
  return getDb()
    .prepare(
      `SELECT dp.payment_method, SUM(dp.amount) AS amount, MAX(dp.payment_date) AS last_date
       FROM due_payments dp
       LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
       WHERE dp.due_id = ? AND pc.id IS NULL
       GROUP BY dp.payment_method
       ORDER BY MIN(dp.id)`,
    )
    .all(dueId);
}

// A manual income prints itself. A dues receipt covers the whole month of the apartment, so two payments
// made in different methods still take one receipt, summed in whole cents to keep the lines adding up.
function readReceipt(id, buildingId) {
  const receipt = getDb()
    .prepare(
      `SELECT i.id, i.amount, i.date, i.description, i.category, i.is_cancelled, i.payer_name, i.payment_method,
              dp.due_id, d.apartment_id, a.apartment_no, d.year, d.month
       FROM incomes i
       LEFT JOIN due_payments dp ON dp.id = i.due_payment_id
       LEFT JOIN dues d ON d.id = dp.due_id
       LEFT JOIN apartments a ON a.id = d.apartment_id
       WHERE i.id = ? AND i.building_id = ?`,
    )
    .get(id, buildingId);
  const blocker = documentBlocker(receipt);
  if (blocker) return blocker;

  if (receipt.due_id == null) {
    const payments = receipt.payment_method ? [{ payment_method: receipt.payment_method, amount: receipt.amount }] : [];
    return { success: true, data: { ...receipt, payments, resident_name: null } };
  }

  const groups = livePaymentsForDue(receipt.due_id);
  const payments = groups.map((group) => ({
    payment_method: group.payment_method,
    amount: Math.round(group.amount * 100) / 100,
  }));
  const totalCents = payments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
  const lastDate = groups.reduce(
    (latest, group) => (group.last_date > latest ? group.last_date : latest),
    receipt.date,
  );

  return {
    success: true,
    data: {
      ...receipt,
      amount: totalCents / 100,
      date: lastDate,
      payer_name: null,
      payment_method: null,
      payments,
      resident_name: residentNameForPaidMonth(receipt),
    },
  };
}

function readVoucher(id, buildingId) {
  const voucher = getDb()
    .prepare(
      `SELECT id, amount, date, description, category, is_cancelled, vendor_name, vendor_address
       FROM expenses WHERE id = ? AND building_id = ?`,
    )
    .get(id, buildingId);
  return documentBlocker(voucher) ?? { success: true, data: voucher };
}

// Everything a receipt or a voucher prints, in one call. Names, dates and amounts come back raw,
// and the renderer formats them the same way it does on screen.
function getDocument(payload) {
  const { id, buildingId, type } = payload;
  try {
    return type === "income" ? readReceipt(id, buildingId) : readVoucher(id, buildingId);
  } catch (err) {
    console.error("[financial.service] getDocument:", err);
    return { success: false, message: "Belge bilgileri alınamadı." };
  }
}

// Only a manual income takes a payer name: a dues receipt always names the apartment's resident of that
// month. The payment method is never written here either, it was chosen when the record was entered.
function saveReceiptInfo(payload) {
  const { id, buildingId, payer_name } = payload;
  const record = getDb()
    .prepare("SELECT is_cancelled, due_payment_id FROM incomes WHERE id = ? AND building_id = ?")
    .get(id, buildingId);
  const blocker = documentBlocker(record);
  if (blocker) return blocker;
  if (record.due_payment_id != null) {
    return { success: false, message: "Aidat makbuzunda ödeyen dairenin sakinidir ve değiştirilemez." };
  }

  getDb()
    .prepare(`UPDATE incomes SET payer_name = ?, updated_at = ${TR_NOW_SQL} WHERE id = ? AND building_id = ?`)
    .run(payer_name, id, buildingId);
  return { success: true, message: "Makbuz bilgileri kaydedildi." };
}

function saveVoucherInfo(payload) {
  const { id, buildingId, vendor_name, vendor_address } = payload;
  const record = getDb()
    .prepare("SELECT is_cancelled, category FROM expenses WHERE id = ? AND building_id = ?")
    .get(id, buildingId);
  const blocker = documentBlocker(record);
  if (blocker) return blocker;

  getDb()
    .prepare(
      `UPDATE expenses SET vendor_name = ?, vendor_address = ?, updated_at = ${TR_NOW_SQL}
       WHERE id = ? AND building_id = ?`,
    )
    .run(vendor_name, vendor_address, id, buildingId);
  return { success: true, message: "Gider pusulası bilgileri kaydedildi." };
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
const saveDocumentInfo = withDbError("saveDocumentInfo", "Belge kaydı", (payload) =>
  payload.type === "income" ? saveReceiptInfo(payload) : saveVoucherInfo(payload),
);

module.exports = {
  addIncome,
  addExpense,
  getTransactions,
  cancelIncome,
  cancelExpense,
  getDocument,
  saveDocumentInfo,
};

// Dues rules. Nothing here is ever deleted. A payment is cancelled with an audit row, and the
// due is worked out again from the payments that are still active.
const fs = require("fs");
const path = require("path");
const { app, shell } = require("electron");
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { RESIDENT_NAME_FOR_PERIOD_SQL } = require("../shared/residentPeriod");
const { TR_NOW_SQL, createdPeriodSql, toPeriod } = require("../shared/trTime");

const COLUMN_LABELS = {
  amount: "Ödeme tutarı",
  payment_method: "Ödeme yöntemi",
  payment_date: "Ödeme tarihi",
  cancel_reason: "İptal nedeni",
  due_amount: "Aidat tutarı",
  paid_amount: "Ödenen tutar",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// Money is compared in whole cents, so a floating point remainder cannot move a limit.
function roundCents(value) {
  return Math.round(value * 100);
}

// The debt left is rounded down and the payment to the nearest cent, so a remainder can never
// break the paid_amount <= due_amount CHECK.
function floorCents(value) {
  return Math.floor(Number((value * 100).toFixed(6)));
}

// Same rule as the status CHECK on the dues table. Change one, change the other.
function calcDueStatus(dueAmount, paidAmount) {
  if (paidAmount >= dueAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

// LEFT JOIN with COALESCE, because the dues row may not exist yet. An apartment is left out of
// the months before it was created.
// apartment_no is TEXT, so a plain sort puts "10" before "2". The GLOB keeps digit-led numbers
// ahead of names like "B2", the CAST orders them by their numeric prefix and the collated column
// breaks ties, which yields 1, 2, 3, 3A, 10, 20, A1, B2.
function getDuesForMonth(payload) {
  const { buildingId, year, month } = payload;
  try {
    ensureMonthlyDues(buildingId);

    const period = toPeriod(year, month);

    // The resident subquery is the one asked for the month being viewed, not the one living there
    // now, so a past month keeps naming whoever lived there then. Its two bindings come first.
    const monthlyDuesData = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type, a.square_meters,
                d.id, d.year, d.month,
                COALESCE(d.due_amount, a.due_amount) AS due_amount,
                COALESCE(d.paid_amount, 0) AS paid_amount,
                COALESCE(d.status, 'unpaid') AS status,
                ${RESIDENT_NAME_FOR_PERIOD_SQL} AS resident_name
         FROM apartments a
         LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
         WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
         ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
                  CAST(a.apartment_no AS INTEGER) ASC,
                  a.apartment_no COLLATE NOCASE ASC`,
      )
      .all(period, period, year, month, buildingId, period);

    // The building's earliest active apartment. Without it the renderer cannot tell "no apartments
    // at all" from "no apartments yet in the month being viewed", since both come back as an empty list.
    const start = getDb()
      .prepare(
        `SELECT CAST(strftime('%Y', MIN(created_at)) AS INTEGER) AS year,
                CAST(strftime('%m', MIN(created_at)) AS INTEGER) AS month
         FROM apartments WHERE building_id = ? AND is_active = 1`,
      )
      .get(buildingId);

    return { success: true, data: monthlyDuesData, start: start.year === null ? null : start };
  } catch (err) {
    console.error("[dues.service] getDuesForMonth:", err);
    return { success: false, message: "Aidat verileri alınamadı." };
  }
}

// Saves the payment, writes the matching income row, and updates the due, all in one transaction.
function recordPayment(payload) {
  const { apartmentId, buildingId, year, month, paymentData } = payload;
  try {
    const apartment = getDb()
      .prepare(
        `SELECT id, apartment_no, due_amount, building_id, ${createdPeriodSql()} AS createdPeriod
         FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`,
      )
      .get(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    // No payment for a month in which the apartment did not exist yet.
    if (toPeriod(year, month) < apartment.createdPeriod) {
      return { success: false, message: "Daire bu dönemde henüz kayıtlı değildi, ödeme alınamaz." };
    }

    // Accrues only this apartment and month, not the whole history of the building. The amount is
    // copied here too, so that rule lives in two places.
    getDb()
      .prepare(`INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount) VALUES (?, ?, ?, ?)`)
      .run(apartmentId, year, month, apartment.due_amount);

    const due = getDb()
      .prepare(`SELECT id, due_amount, paid_amount FROM dues WHERE apartment_id = ? AND year = ? AND month = ?`)
      .get(apartmentId, year, month);

    const remainingCents = floorCents(due.due_amount - due.paid_amount);
    const amountCents = roundCents(paymentData.amount);
    // The renderer has no limit of its own. It shows the amount this branch returns.
    if (amountCents > remainingCents) {
      return {
        success: false,
        code: "OVERPAYMENT",
        remaining: remainingCents / 100,
        message: "Kalan borçtan fazla ödeme yapılamaz.",
      };
    }

    const { amount, payment_method, payment_date, note, collector_name, collected_by, receipt } = paymentData;

    getDb().transaction(() => {
      const { lastInsertRowid: paymentId } = getDb()
        .prepare(
          `INSERT INTO due_payments
             (due_id, amount, payment_method, payment_date, note, collector_name, receipt_name, receipt_blob,
              collected_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL})`,
        )
        .run(
          due.id,
          amount,
          payment_method,
          payment_date,
          note || null,
          collector_name || null,
          receipt?.name ?? null,
          receipt ? Buffer.from(receipt.data) : null,
          collected_by,
        );

      // The matching income row. This is the only place a dues income is written.
      getDb()
        .prepare(
          `INSERT INTO incomes (amount, date, description, category, building_id, due_payment_id, created_at, updated_at)
           VALUES (?, ?, ?, 'dues', ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
        )
        .run(amount, payment_date, `Aidat Ödemesi - Daire ${apartment.apartment_no}`, apartment.building_id, paymentId);

      const newPaidAmount = (roundCents(due.paid_amount) + amountCents) / 100;
      getDb()
        .prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
        .run(newPaidAmount, calcDueStatus(due.due_amount, newPaidAmount), due.id);
    })();

    return { success: true, message: "Ödeme kaydedildi." };
  } catch (err) {
    console.error("[dues.service] recordPayment:", err);
    return { success: false, message: resolveDbError(err, "Ödeme kaydetme") };
  }
}

// Cancels a payment by writing an audit row that can never change. The payment row stays.
function cancelPayment(payload) {
  const { paymentId, buildingId, userId, reason } = payload;
  try {
    const payment = getDb()
      .prepare(
        `SELECT dp.id, dp.due_id, dp.amount, d.due_amount
         FROM due_payments dp
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         WHERE dp.id = ? AND a.building_id = ?`,
      )
      .get(paymentId, buildingId);
    if (!payment) return { success: false, message: "Ödeme kaydı bulunamadı." };

    const alreadyCancelled = getDb()
      .prepare(`SELECT id FROM payment_cancellations WHERE payment_id = ?`)
      .get(paymentId);
    if (alreadyCancelled) return { success: false, message: "Bu ödeme zaten iptal edilmiş." };

    getDb().transaction(() => {
      getDb()
        .prepare(
          `INSERT INTO payment_cancellations (payment_id, cancel_reason, cancelled_by, cancelled_at)
           VALUES (?, ?, ?, ${TR_NOW_SQL})`,
        )
        .run(paymentId, reason, userId);

      getDb()
        .prepare(
          `UPDATE incomes SET is_cancelled = 1, cancelled_at = ${TR_NOW_SQL}, cancel_reason = ?, cancelled_by = ?,
           updated_at = ${TR_NOW_SQL} WHERE due_payment_id = ? AND is_cancelled = 0`,
        )
        .run(reason, userId, paymentId);

      // paid_amount is summed again from the active payments instead of being subtracted, so running
      // this twice cannot break it.
      const { total: activePaidTotal } = getDb()
        .prepare(
          `SELECT COALESCE(SUM(dp.amount), 0) AS total
           FROM due_payments dp
           WHERE dp.due_id = ? AND NOT EXISTS (
             SELECT 1 FROM payment_cancellations pc WHERE pc.payment_id = dp.id
           )`,
        )
        .get(payment.due_id);

      const newPaidAmount = roundCents(activePaidTotal) / 100;
      getDb()
        .prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
        .run(newPaidAmount, calcDueStatus(payment.due_amount, newPaidAmount), payment.due_id);
    })();

    return { success: true, message: "Ödeme iptal edildi." };
  } catch (err) {
    console.error("[dues.service] cancelPayment:", err);
    return { success: false, message: resolveDbError(err, "Ödeme iptali") };
  }
}

function getPaymentHistory(payload) {
  const { dueId, buildingId } = payload;
  try {
    const data = getDb()
      .prepare(
        `SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.note, dp.created_at,
                dp.receipt_name,
                COALESCE(dp.collector_name, u.manager_name) AS collector_name,
                pc.cancel_reason, pc.cancelled_at
         FROM due_payments dp
         JOIN users u ON dp.collected_by = u.id
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
         WHERE dp.due_id = ? AND a.building_id = ?
         ORDER BY dp.created_at DESC, dp.id DESC`,
      )
      .all(dueId, buildingId);
    return { success: true, data };
  } catch (err) {
    console.error("[dues.service] getPaymentHistory:", err);
    return { success: false, message: "Ödeme geçmişi alınamadı." };
  }
}

// Puts a receipt on a payment that was recorded without one, or replaces the one it has. Reading
// stays open on a cancelled payment, writing does not.
function attachReceipt(payload) {
  const { paymentId, buildingId, receipt } = payload;
  try {
    const payment = getDb()
      .prepare(
        `SELECT dp.id, pc.id AS cancellation_id
         FROM due_payments dp
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
         WHERE dp.id = ? AND a.building_id = ?`,
      )
      .get(paymentId, buildingId);
    if (!payment) return { success: false, message: "Ödeme kaydı bulunamadı." };
    if (payment.cancellation_id) {
      return { success: false, message: "İptal edilmiş bir ödemenin dekontu değiştirilemez." };
    }

    getDb()
      .prepare(`UPDATE due_payments SET receipt_name = ?, receipt_blob = ? WHERE id = ?`)
      .run(receipt.name, Buffer.from(receipt.data), paymentId);

    return { success: true, message: "Dekont kaydedildi." };
  } catch (err) {
    console.error("[dues.service] attachReceipt:", err);
    return { success: false, message: resolveDbError(err, "Dekont kaydetme") };
  }
}

// The renderer cannot open a file, so the blob is written to a temp file and handed to the shell.
// Only the extension of the stored name is reused: a name built here keeps the stored one out of
// the path, and the payment id keeps two receipts with the same file name apart.
async function openReceipt(payload) {
  const { paymentId, buildingId } = payload;
  try {
    const payment = getDb()
      .prepare(
        `SELECT dp.receipt_name, dp.receipt_blob
         FROM due_payments dp
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         WHERE dp.id = ? AND a.building_id = ?`,
      )
      .get(paymentId, buildingId);
    if (!payment) return { success: false, message: "Ödeme kaydı bulunamadı." };
    if (!payment.receipt_blob) return { success: false, message: "Bu ödemeye ait dekont yok." };

    // The extension is safe to trust: a schema CHECK keeps receipt_name to the accepted list.
    const extension = payment.receipt_name.split(".").pop().toLowerCase();
    const filePath = path.join(app.getPath("temp"), `mavikent-dekont-${paymentId}.${extension}`);
    await fs.promises.writeFile(filePath, payment.receipt_blob);

    // openPath resolves with an error string instead of rejecting.
    const openError = await shell.openPath(filePath);
    if (openError) {
      console.error("[dues.service] openReceipt:", openError);
      return { success: false, message: "Dekont dosyası açılamadı." };
    }

    // Nothing to report: the file itself opening is the result the user sees.
    return { success: true };
  } catch (err) {
    console.error("[dues.service] openReceipt:", err);
    return { success: false, message: "Dekont açılamadı." };
  }
}

module.exports = { getDuesForMonth, recordPayment, cancelPayment, getPaymentHistory, attachReceipt, openReceipt };

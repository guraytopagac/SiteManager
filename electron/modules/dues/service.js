// Dues rules. Nothing here is ever deleted. A payment is cancelled with an audit row, and the
// due is worked out again from the payments that are still active.
const fs = require("fs");
const path = require("path");
const { app, shell } = require("electron");
const { getDb } = require("../../../database/db");
const { accountBlocker, accountCancelBlocker, accountForMethod } = require("../shared/cashAccounts");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { managerAtSql } = require("../shared/managerTerms");
const { RESIDENT_NAME_FOR_PERIOD_SQL, periodCutoff } = require("../shared/residentPeriod");
const { TR_NOW_SQL, createdPeriodSql, currentPeriod, fromPeriod, toPeriod } = require("../shared/trTime");

// How many months a prepayment spans, the current one included. The handler holds the same limit next to its
// message.
const PREPAYMENT_MONTHS = 12;

const COLUMN_LABELS = {
  amount: "Ödeme tutarı",
  payment_method: "Ödeme yöntemi",
  payment_date: "Ödeme tarihi",
  cancel_reason: "İptal nedeni",
  due_amount: "Aidat tutarı",
  paid_amount: "Ödenen tutar",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

// The two charges a payment can settle. They differ in where the money is booked and in what the income row
// says, everything else about taking a payment is the same.
const DUE_TYPES = {
  regular: {
    category: "dues",
    describe: (apartmentNo) => `Aidat Ödemesi - Daire ${apartmentNo}`,
    missing: "Bu dönem için aidat tahakkuku bulunamadı.",
  },
  investment: {
    category: "investment_dues",
    describe: (apartmentNo) => `Yatırım Aidatı Ödemesi - Daire ${apartmentNo}`,
    missing: "Bu dönemde yatırım aidatı tahakkuk etmemiş, ödeme alınamaz.",
  },
};

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

// LEFT JOIN with COALESCE, since the dues row may not exist yet. Months before the apartment are left out.
// apartment_no is TEXT, so a plain sort puts "10" before "2". GLOB keeps digit-led numbers ahead of names
// like "B2", CAST orders them by the numeric prefix and the collated column breaks ties: 1, 3A, 10, A1.
function getDuesForMonth(payload) {
  const { buildingId, year, month } = payload;
  try {
    ensureMonthlyDues(buildingId);

    const period = toPeriod(year, month);
    const cutoff = periodCutoff(year, month);

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
         LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ? AND d.due_type = 'regular'
         WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
         ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
                  CAST(a.apartment_no AS INTEGER) ASC,
                  rtrim(a.apartment_no, '0123456789') COLLATE NOCASE ASC,
                  CAST(substr(a.apartment_no, length(rtrim(a.apartment_no, '0123456789')) + 1) AS INTEGER) ASC,
                  a.apartment_no COLLATE NOCASE ASC`,
      )
      .all(cutoff, cutoff, year, month, buildingId, period);

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

// Takes a payment against one apartment and month. dueType says which of the two charges it settles, and
// the handler has already checked that it is one of them.
function recordPayment(payload) {
  const { apartmentId, buildingId, year, month, dueType, paymentData } = payload;
  const charge = DUE_TYPES[dueType];
  try {
    const apartment = getDb()
      .prepare(
        `SELECT id, apartment_no, due_amount, building_id, ${createdPeriodSql()} AS createdPeriod
         FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`,
      )
      .get(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    if (toPeriod(year, month) < apartment.createdPeriod) {
      return { success: false, message: "Daire bu dönemde henüz kayıtlı değildi, ödeme alınamaz." };
    }

    // The monthly charge is accrued here when it is missing, for this apartment and month alone rather than
    // for the whole history of the building. The amount is copied here too, so that rule lives in two places.
    // An investment charge is never accrued here: a missing row means the fund was not collecting that
    // month, which is an answer rather than a gap to fill.
    if (dueType === "regular") {
      getDb()
        .prepare(
          `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_type, due_amount)
           VALUES (?, ?, ?, 'regular', ?)`,
        )
        .run(apartmentId, year, month, apartment.due_amount);
    }

    const due = getDb()
      .prepare(
        `SELECT id, due_amount, paid_amount FROM dues
         WHERE apartment_id = ? AND year = ? AND month = ? AND due_type = ?`,
      )
      .get(apartmentId, year, month, dueType);
    if (!due) return { success: false, message: charge.missing };

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

    getDb().transaction(() => {
      writePayment(due, amountCents, paymentData, {
        buildingId: apartment.building_id,
        category: charge.category,
        description: charge.describe(apartment.apartment_no),
      });
    })();

    return { success: true, message: "Ödeme kaydedildi." };
  } catch (err) {
    console.error("[dues.service] recordPayment:", err);
    return { success: false, message: resolveDbError(err, "Ödeme kaydetme") };
  }
}

// The three writes of one payment: the payment row, its income row and the due's new paid amount. The caller
// wraps it in a transaction. The income row is written only here, for dues and investment alike, and its
// account follows the payment method, the same rule a manual income uses.
function writePayment(due, amountCents, paymentData, income) {
  const { payment_method, payment_date, note, collector_name, collected_by, receipt } = paymentData;
  const amount = amountCents / 100;

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

  getDb()
    .prepare(
      `INSERT INTO incomes
         (amount, date, description, category, building_id, due_payment_id, account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
    )
    .run(
      amount,
      payment_date,
      income.description,
      income.category,
      income.buildingId,
      paymentId,
      accountForMethod(payment_method),
    );

  const newPaidAmount = (roundCents(due.paid_amount) + amountCents) / 100;
  getDb()
    .prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
    .run(newPaidAmount, calcDueStatus(due.due_amount, newPaidAmount), due.id);
}

function findActiveApartment(apartmentId, buildingId) {
  return getDb()
    .prepare(`SELECT id, apartment_no, due_amount FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
    .get(apartmentId, buildingId);
}

// The current month and the eleven after it, each with what is owed and what is paid. A month with no row
// yet is shown at the apartment's amount today, which is the amount it would be accrued at.
function prepaymentMonths(apartment) {
  const firstPeriod = currentPeriod();
  const { year, month } = fromPeriod(firstPeriod);
  const rows = getDb()
    .prepare(
      `SELECT id, year, month, due_amount, paid_amount FROM dues
       WHERE apartment_id = ? AND due_type = 'regular' AND (year > ? OR (year = ? AND month >= ?))`,
    )
    .all(apartment.id, year, year, month);
  const rowsByPeriod = new Map(rows.map((row) => [toPeriod(row.year, row.month), row]));

  const months = [];
  for (let period = firstPeriod; period < firstPeriod + PREPAYMENT_MONTHS; period += 1) {
    const row = rowsByPeriod.get(period);
    const dueAmount = row ? row.due_amount : apartment.due_amount;
    const paidAmount = row ? row.paid_amount : 0;
    months.push({
      ...fromPeriod(period),
      due_amount: dueAmount,
      paid_amount: paidAmount,
      remaining: floorCents(dueAmount - paidAmount) / 100,
    });
  }
  return months;
}

// The months of the plan that fall between the payload's start and end months, both included.
function monthsInRange(months, { startYear, startMonth, endYear, endMonth }) {
  const startPeriod = toPeriod(startYear, startMonth);
  const endPeriod = toPeriod(endYear, endMonth);
  return months.filter((item) => {
    const period = toPeriod(item.year, item.month);
    return period >= startPeriod && period <= endPeriod;
  });
}

function getPrepaymentPlan(payload) {
  const { apartmentId, buildingId } = payload;
  try {
    const apartment = findActiveApartment(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    return { success: true, data: prepaymentMonths(apartment) };
  } catch (err) {
    console.error("[dues.service] getPrepaymentPlan:", err);
    return { success: false, message: "Peşin ödeme bilgileri alınamadı." };
  }
}

// Pays every month of the chosen range in full, skipping the ones already paid.
// Each month gets its own payment and income row, so cancelling, receipts and the history work month by
// month exactly as they do for a single payment. The income is dated the day the money came in.
function recordPrepayment(payload) {
  const { apartmentId, buildingId, paymentData } = payload;
  try {
    const apartment = findActiveApartment(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    const openMonths = monthsInRange(prepaymentMonths(apartment), payload).filter((item) => item.remaining > 0);
    if (openMonths.length === 0) {
      return { success: false, message: "Seçilen ayların tamamı zaten ödenmiş." };
    }

    getDb().transaction(() => {
      for (const { year, month } of openMonths) {
        // A future month is accrued here, ahead of ensureMonthlyDues, at today's amount. A later rise
        // reaches it through the apartment service and leaves the difference as debt.
        getDb()
          .prepare(
            `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_type, due_amount)
             VALUES (?, ?, ?, 'regular', ?)`,
          )
          .run(apartment.id, year, month, apartment.due_amount);

        const due = getDb()
          .prepare(
            `SELECT id, due_amount, paid_amount FROM dues
             WHERE apartment_id = ? AND year = ? AND month = ? AND due_type = 'regular'`,
          )
          .get(apartment.id, year, month);

        writePayment(due, floorCents(due.due_amount - due.paid_amount), paymentData, {
          buildingId,
          category: DUE_TYPES.regular.category,
          description: `Peşin Aidat Ödemesi - Daire ${apartment.apartment_no}, ${month}/${year}`,
        });
      }
    })();

    return {
      success: true,
      message: `Daire ${apartment.apartment_no} için ${openMonths.length} aylık peşin aidat kaydedildi.`,
    };
  } catch (err) {
    console.error("[dues.service] recordPrepayment:", err);
    return { success: false, message: resolveDbError(err, "Peşin ödeme kaydetme") };
  }
}

function cancelPayment(payload) {
  const { paymentId, buildingId, userId, reason } = payload;
  try {
    const payment = getDb()
      .prepare(
        `SELECT dp.id, dp.due_id, dp.amount, d.due_amount, i.amount AS income_amount, i.account AS income_account
         FROM due_payments dp
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         LEFT JOIN incomes i ON i.due_payment_id = dp.id AND i.is_cancelled = 0
         WHERE dp.id = ? AND a.building_id = ?`,
      )
      .get(paymentId, buildingId);
    if (!payment) return { success: false, message: "Ödeme kaydı bulunamadı." };

    const alreadyCancelled = getDb()
      .prepare(`SELECT id FROM payment_cancellations WHERE payment_id = ?`)
      .get(paymentId);
    if (alreadyCancelled) return { success: false, message: "Bu ödeme zaten iptal edilmiş." };

    // Cancelling takes the collected money back out of the account it landed in, which may not go below zero.
    if (payment.income_account) {
      const blocker = accountCancelBlocker(buildingId, payment.income_account, payment.income_amount);
      if (blocker) return blocker;
    }

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

// An empty collector falls back to the manager whose term the payment was made in, not to today's account
// holder, who after a handover is someone else.
function getPaymentHistory(payload) {
  const { dueId, buildingId } = payload;
  try {
    const data = getDb()
      .prepare(
        `SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.note, dp.created_at,
                dp.receipt_name,
                COALESCE(dp.collector_name, ${managerAtSql("dp.created_at")}) AS collector_name,
                pc.cancel_reason, pc.cancelled_at, i.id AS income_id
         FROM due_payments dp
         JOIN dues d ON dp.due_id = d.id
         JOIN apartments a ON d.apartment_id = a.id
         LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
         LEFT JOIN incomes i ON i.due_payment_id = dp.id
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

// The renderer cannot open a file, so the blob is written to a temp file and handed to the shell. Only the
// stored extension is reused, and the payment id keeps two receipts with the same name apart.
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

// Hands prepaid dues back, every paid month of the chosen range. The payments of those months are closed
// with an audit row the way a cancellation closes them, but their incomes stay: the money did come in on the
// day it was paid. What goes back out is one expense on the refund day, so the ledger shows both movements on
// their own dates. The months return to unpaid and are owed again by whoever lives there when they come.
function refundPrepayment(payload) {
  const { apartmentId, buildingId, userId, refund } = payload;
  try {
    const apartment = findActiveApartment(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    const paidMonths = monthsInRange(prepaymentMonths(apartment), payload).filter((item) => item.paid_amount > 0);
    if (paidMonths.length === 0) {
      return { success: false, message: "Seçilen aylarda iade edilecek ödeme yok." };
    }

    const totalCents = paidMonths.reduce((sum, item) => sum + roundCents(item.paid_amount), 0);
    const blocker = accountBlocker(buildingId, refund.account, totalCents / 100);
    if (blocker) return blocker;

    const first = paidMonths[0];
    const last = paidMonths[paidMonths.length - 1];
    const span =
      paidMonths.length === 1
        ? `${first.month}/${first.year}`
        : `${first.month}/${first.year} - ${last.month}/${last.year}`;
    const reason = `Peşin ödeme iadesi: ${refund.payee_name}`;

    getDb().transaction(() => {
      getDb()
        .prepare(
          `INSERT INTO expenses
             (building_id, amount, date, description, category, vendor_name, account, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'dues_refund', ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
        )
        .run(
          buildingId,
          totalCents / 100,
          refund.date,
          `Peşin aidat iadesi - Daire ${apartment.apartment_no}, ${span}, iade edilen: ${refund.payee_name}`,
          refund.payee_name,
          refund.account,
        );

      for (const { year, month } of paidMonths) {
        const due = getDb()
          .prepare(`SELECT id FROM dues WHERE apartment_id = ? AND year = ? AND month = ? AND due_type = 'regular'`)
          .get(apartment.id, year, month);

        getDb()
          .prepare(
            `INSERT INTO payment_cancellations (payment_id, cancel_reason, cancelled_by, cancelled_at)
             SELECT dp.id, ?, ?, ${TR_NOW_SQL} FROM due_payments dp
             WHERE dp.due_id = ?
               AND NOT EXISTS (SELECT 1 FROM payment_cancellations pc WHERE pc.payment_id = dp.id)`,
          )
          .run(reason, userId, due.id);

        getDb()
          .prepare(`UPDATE dues SET paid_amount = 0, status = 'unpaid', updated_at = ${TR_NOW_SQL} WHERE id = ?`)
          .run(due.id);
      }
    })();

    return {
      success: true,
      message: `Daire ${apartment.apartment_no} için ${paidMonths.length} aylık aidat iadesi kaydedildi.`,
    };
  } catch (err) {
    console.error("[dues.service] refundPrepayment:", err);
    return { success: false, message: resolveDbError(err, "Aidat iadesi") };
  }
}

module.exports = {
  getDuesForMonth,
  recordPayment,
  getPrepaymentPlan,
  recordPrepayment,
  refundPrepayment,
  cancelPayment,
  getPaymentHistory,
  attachReceipt,
  openReceipt,
};

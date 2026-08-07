const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureMonthlyDues } = require("../shared/duesAccrual");

const COLUMN_LABELS = {
  amount: "Ödeme tutarı",
  payment_method: "Ödeme yöntemi",
  payment_date: "Ödeme tarihi",
  note: "Not",
  cancel_reason: "İptal nedeni",
  due_amount: "Aidat tutarı",
  paid_amount: "Ödenen tutar",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function calcDueStatus(dueAmount, paidAmount) {
  if (paidAmount >= dueAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

function getDuesForMonth(buildingId, year, month) {
  try {
    ensureMonthlyDues(buildingId);

    const monthlyDuesData = getDb()
      .prepare(
        `
      SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type, a.square_meters,
             d.id, d.year, d.month,
             COALESCE(d.due_amount, a.due_amount) AS due_amount,
             COALESCE(d.paid_amount, 0) AS paid_amount,
             COALESCE(d.status, 'unpaid') AS status,
             r.full_name AS resident_name
      FROM apartments a
      LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
      LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
      WHERE a.building_id = ? AND a.is_active = 1
      ORDER BY a.apartment_no ASC
    `,
      )
      .all(year, month, buildingId);

    return { success: true, data: monthlyDuesData };
  } catch (err) {
    console.error("[dues.service] getDuesForMonth:", err);
    return { success: false, message: "Aidat verileri alınamadı." };
  }
}

function recordPayment(apartmentId, buildingId, year, month, paymentData) {
  try {
    const apartment = getDb()
      .prepare(
        `SELECT id, apartment_no, due_amount, building_id
         FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`,
      )
      .get(apartmentId, buildingId);
    if (!apartment) return { success: false, message: "Daire bulunamadı veya bu işlem için yetkiniz yok." };

    getDb().prepare(`INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount) VALUES (?, ?, ?, ?)`).run(
      apartmentId,
      year,
      month,
      apartment.due_amount,
    );

    const due = getDb()
      .prepare(`SELECT id, due_amount, paid_amount FROM dues WHERE apartment_id = ? AND year = ? AND month = ?`)
      .get(apartmentId, year, month);

    const remaining = parseFloat((due.due_amount - due.paid_amount).toFixed(2));
    if (paymentData.amount > remaining)
      return { success: false, message: `Fazla ödeme yapılamaz. Kalan borç: ${remaining}₺` };

    const { amount, payment_method, payment_date, note, collected_by } = paymentData;

    getDb().transaction(() => {
      const { lastInsertRowid: paymentId } = getDb()
        .prepare(
          `
        INSERT INTO due_payments (due_id, amount, payment_method, payment_date, note, collected_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))
      `,
        )
        .run(due.id, amount, payment_method, payment_date, note || null, collected_by);

      getDb().prepare(
        `
        INSERT INTO incomes (amount, date, description, category, building_id, due_payment_id, created_at, updated_at)
        VALUES (?, ?, ?, 'dues', ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))
      `,
      ).run(amount, payment_date, `Aidat Ödemesi - Daire ${apartment.apartment_no}`, apartment.building_id, paymentId);

      const newPaidAmount = parseFloat((due.paid_amount + amount).toFixed(2));
      getDb().prepare(
        `UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`,
      ).run(newPaidAmount, calcDueStatus(due.due_amount, newPaidAmount), due.id);
    })();

    return { success: true, message: "Ödeme başarıyla kaydedildi." };
  } catch (err) {
    console.error("[dues.service] recordPayment:", err);
    return { success: false, message: resolveDbError(err, "Ödeme kaydetme") };
  }
}

function cancelPayment(paymentId, buildingId, userId, reason) {
  try {
    const payment = getDb()
      .prepare(
        `
        SELECT dp.id, dp.due_id, dp.amount
        FROM due_payments dp
        JOIN dues d ON dp.due_id = d.id
        JOIN apartments a ON d.apartment_id = a.id
        WHERE dp.id = ? AND a.building_id = ?
      `,
      )
      .get(paymentId, buildingId);
    if (!payment) return { success: false, message: "Ödeme kaydı bulunamadı." };

    const alreadyCancelled = getDb().prepare(`SELECT id FROM payment_cancellations WHERE payment_id = ?`).get(paymentId);
    if (alreadyCancelled) return { success: false, message: "Bu ödeme zaten iptal edilmiş." };

    getDb().transaction(() => {
      getDb().prepare(
        `INSERT INTO payment_cancellations (payment_id, cancel_reason, cancelled_by, cancelled_at)
         VALUES (?, ?, ?, datetime('now', '+3 hours'))`,
      ).run(paymentId, reason, userId);

      getDb().prepare(
        `
        UPDATE incomes SET is_cancelled = 1, cancelled_at = datetime('now', '+3 hours'), cancel_reason = ?, cancelled_by = ?,
        updated_at = datetime('now', '+3 hours') WHERE due_payment_id = ? AND is_cancelled = 0
      `,
      ).run(reason, userId, paymentId);

      const { total: activePaidTotal } = getDb()
        .prepare(
          `
        SELECT COALESCE(SUM(dp.amount), 0) AS total
        FROM due_payments dp
        WHERE dp.due_id = ? AND NOT EXISTS (
          SELECT 1 FROM payment_cancellations pc WHERE pc.payment_id = dp.id
        )
      `,
        )
        .get(payment.due_id);

      const { due_amount } = getDb().prepare(`SELECT due_amount FROM dues WHERE id = ?`).get(payment.due_id);
      const newPaidAmount = parseFloat(Number(activePaidTotal).toFixed(2));
      getDb().prepare(
        `UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`,
      ).run(newPaidAmount, calcDueStatus(due_amount, newPaidAmount), payment.due_id);
    })();

    return { success: true, message: "Ödeme başarıyla iptal edildi." };
  } catch (err) {
    console.error("[dues.service] cancelPayment:", err);
    return { success: false, message: resolveDbError(err, "Ödeme iptali") };
  }
}

function getPaymentHistory(dueId, buildingId) {
  try {
    const data = getDb()
      .prepare(
        `
      SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.note, dp.created_at,
             u.username AS collected_by_username,
             pc.cancel_reason, pc.cancelled_at,
             cu.username AS cancelled_by_username
      FROM due_payments dp
      JOIN users u ON dp.collected_by = u.id
      JOIN dues d ON dp.due_id = d.id
      JOIN apartments a ON d.apartment_id = a.id
      LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
      LEFT JOIN users cu ON cu.id = pc.cancelled_by
      WHERE dp.due_id = ? AND a.building_id = ?
      ORDER BY dp.created_at DESC
    `,
      )
      .all(dueId, buildingId);
    return { success: true, data };
  } catch (err) {
    console.error("[dues.service] getPaymentHistory:", err);
    return { success: false, message: "Ödeme geçmişi alınamadı." };
  }
}

module.exports = { getDuesForMonth, recordPayment, cancelPayment, getPaymentHistory };

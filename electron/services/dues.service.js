const { db } = require("../../database/db");

function calcDueStatus(dueAmount, paidAmount) {
  if (paidAmount >= dueAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

function getDuesForMonth(managerId, year, month) {
  try {
    const data = db
      .prepare(
        `
      SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type, a.square_meters,
             d.id, d.year, d.month,
             COALESCE(d.due_amount, a.due_amount) AS due_amount,
             COALESCE(d.paid_amount, 0) AS paid_amount,
             COALESCE(d.status, 'unpaid') AS status,
             r.full_name AS resident_name, r.phone AS resident_phone, r.email AS resident_email,
             r.national_id AS resident_national_id, r.resident_type, r.move_in_date AS resident_move_in_date,
             r.move_out_date AS resident_move_out_date, r.notes AS resident_notes
      FROM apartments a
      LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
      LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
      WHERE a.manager_id = ? AND a.is_active = 1
      ORDER BY a.apartment_no ASC
    `,
      )
      .all(year, month, managerId);

    return { success: true, data };
  } catch (err) {
    console.error("[dues] getDuesForMonth:", err);
    return { success: false, message: "Aidat verileri alınamadı." };
  }
}

function recordPayment(apartmentId, year, month, paymentData) {
  try {
    db.transaction(() => {
      const apartment = db
        .prepare(`SELECT id, apartment_no, due_amount FROM apartments WHERE id = ? AND is_active = 1`)
        .get(apartmentId);
      if (!apartment) throw new Error("Daire bulunamadı.");

      db.prepare(`INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount) VALUES (?, ?, ?, ?)`).run(
        apartmentId,
        year,
        month,
        apartment.due_amount,
      );

      const due = db
        .prepare(`SELECT id, due_amount, paid_amount FROM dues WHERE apartment_id = ? AND year = ? AND month = ?`)
        .get(apartmentId, year, month);

      const remaining = parseFloat((due.due_amount - due.paid_amount).toFixed(2));
      if (paymentData.amount > remaining) throw new Error(`Fazla ödeme yapılamaz. Kalan borç: ${remaining}₺`);

      const { amount, payment_method, payment_date, note, collected_by } = paymentData;

      const { lastInsertRowid: paymentId } = db
        .prepare(
          `
        INSERT INTO due_payments (due_id, amount, payment_method, payment_date, note, collected_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(due.id, amount, payment_method, payment_date, note || null, collected_by);

      db.prepare(
        `
        INSERT INTO incomes (amount, date, description, category, manager_id, due_payment_id)
        VALUES (?, ?, ?, 'dues', ?, ?)
      `,
      ).run(amount, payment_date, `Aidat Ödemesi - Daire ${apartment.apartment_no}`, collected_by, paymentId);

      const newPaidAmount = parseFloat((due.paid_amount + amount).toFixed(2));
      db.prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        newPaidAmount,
        calcDueStatus(due.due_amount, newPaidAmount),
        due.id,
      );
    })();

    return { success: true, message: "Ödeme başarıyla kaydedildi." };
  } catch (err) {
    console.error("[dues.service] recordPayment:", err);
    return { success: false, message: err.message || "Ödeme kaydedilemedi." };
  }
}

function cancelPayment(paymentId, userId, reason) {
  try {
    db.transaction(() => {
      const payment = db
        .prepare(
          `
        SELECT dp.id, dp.due_id, dp.amount
        FROM due_payments dp
        JOIN dues d ON dp.due_id = d.id
        JOIN apartments a ON d.apartment_id = a.id
        WHERE dp.id = ? AND a.manager_id = ?
      `,
        )
        .get(paymentId, userId);
      if (!payment) throw new Error("Ödeme kaydı bulunamadı.");

      const alreadyCancelled = db.prepare(`SELECT id FROM payment_cancellations WHERE payment_id = ?`).get(paymentId);
      if (alreadyCancelled) throw new Error("Bu ödeme zaten iptal edilmiş.");

      db.prepare(`INSERT INTO payment_cancellations (payment_id, cancel_reason, cancelled_by) VALUES (?, ?, ?)`).run(
        paymentId,
        reason,
        userId,
      );

      db.prepare(
        `
        UPDATE incomes SET is_cancelled = 1, cancelled_at = datetime('now'), cancel_reason = ?, cancelled_by = ?,
        updated_at = datetime('now') WHERE due_payment_id = ? AND is_cancelled = 0
      `,
      ).run(reason, userId, paymentId);

      const { total: activePaidTotal } = db
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

      const { due_amount } = db.prepare(`SELECT due_amount FROM dues WHERE id = ?`).get(payment.due_id);
      const newPaidAmount = parseFloat(Number(activePaidTotal).toFixed(2));
      db.prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        newPaidAmount,
        calcDueStatus(due_amount, newPaidAmount),
        payment.due_id,
      );
    })();

    return { success: true, message: "Ödeme başarıyla iptal edildi." };
  } catch (err) {
    console.error("[dues] cancelPayment:", err);
    return { success: false, message: err.message || "Ödeme iptal edilemedi." };
  }
}

function getPaymentHistory(dueId) {
  if (!dueId) return { success: true, data: [] };
  try {
    const data = db
      .prepare(
        `
      SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.note, dp.created_at,
             u.username AS collected_by_username,
             pc.cancel_reason, pc.cancelled_at,
             cu.username AS cancelled_by_username
      FROM due_payments dp
      JOIN users u ON dp.collected_by = u.id
      LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
      LEFT JOIN users cu ON cu.id = pc.cancelled_by
      WHERE dp.due_id = ?
      ORDER BY dp.created_at DESC
    `,
      )
      .all(dueId);
    return { success: true, data };
  } catch (err) {
    console.error("[dues.service] getPaymentHistory:", err);
    return { success: false, message: "Ödeme geçmişi alınamadı." };
  }
}

module.exports = { getDuesForMonth, recordPayment, cancelPayment, getPaymentHistory };

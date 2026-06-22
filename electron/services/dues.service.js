const db = require("../../database/db");

class DuesError extends Error {}

const insertDue = db.prepare(`INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount) VALUES (?, ?, ?, ?)`);

const getDuesTransaction = db.transaction((managerId, year, month) => {
  const apartments = db.prepare(`SELECT id, due_amount FROM apartments WHERE manager_id = ?`).all(managerId);
  for (const apt of apartments) {
    insertDue.run(apt.id, year, month, apt.due_amount);
  }
  return db
    .prepare(
      `SELECT d.id, d.apartment_id, d.year, d.month, d.due_amount, d.paid_amount, d.status,
              a.apartment_no, a.floor, a.type, a.square_meters,
              a.resident_name, a.resident_phone, a.resident_email
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.manager_id = ? AND d.year = ? AND d.month = ?
       ORDER BY a.apartment_no ASC`,
    )
    .all(managerId, year, month);
});

function getDuesForMonth(managerId, year, month) {
  try {
    const data = getDuesTransaction(managerId, year, month);
    return { success: true, data };
  } catch {
    return { success: false, message: "Aidat verileri alınamadı." };
  }
}

const recordPaymentTx = db.transaction((dueId, paymentData) => {
  const due = db.prepare(`SELECT id, due_amount, paid_amount FROM dues WHERE id = ?`).get(dueId);
  if (!due) throw new DuesError("Aidat kaydı bulunamadı.");

  const remaining = parseFloat((due.due_amount - due.paid_amount).toFixed(2));
  if (paymentData.amount > remaining) {
    throw new DuesError(`Fazla ödeme yapılamaz. Kalan borç: ${remaining}₺`);
  }

  const { amount, payment_method, payment_date, receipt_path, note, collected_by } = paymentData;

  db.prepare(
    `INSERT INTO due_payments (due_id, amount, payment_method, payment_date, receipt_path, note, collected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(dueId, amount, payment_method, payment_date, receipt_path || null, note || null, collected_by);

  const newPaidAmount = parseFloat((due.paid_amount + amount).toFixed(2));
  const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

  db.prepare(`UPDATE dues SET paid_amount = ?, status = ? WHERE id = ?`).run(newPaidAmount, newStatus, dueId);
});

function recordPayment(dueId, paymentData) {
  try {
    recordPaymentTx(dueId, paymentData);
    return { success: true, message: "Ödeme başarıyla kaydedildi." };
  } catch (err) {
    if (err instanceof DuesError) return { success: false, message: err.message };
    return { success: false, message: "Ödeme kaydedilemedi." };
  }
}

const cancelPaymentTx = db.transaction((paymentId, reason) => {
  const payment = db.prepare(`SELECT id, due_id, amount, is_cancelled FROM due_payments WHERE id = ?`).get(paymentId);
  if (!payment) throw new DuesError("Ödeme kaydı bulunamadı.");
  if (payment.is_cancelled) throw new DuesError("Bu ödeme zaten iptal edilmiş.");

  db.prepare(`UPDATE due_payments SET is_cancelled = 1, cancelled_at = ?, cancel_reason = ? WHERE id = ?`).run(
    new Date().toISOString(),
    reason,
    paymentId,
  );

  const { total } = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM due_payments WHERE due_id = ? AND is_cancelled = 0`)
    .get(payment.due_id);

  const due = db.prepare(`SELECT due_amount FROM dues WHERE id = ?`).get(payment.due_id);
  if (!due) throw new DuesError("Aidat kaydı bulunamadı.");

  const newPaidAmount = parseFloat(Number(total).toFixed(2));
  const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

  db.prepare(`UPDATE dues SET paid_amount = ?, status = ? WHERE id = ?`).run(newPaidAmount, newStatus, payment.due_id);
});

function cancelPayment(paymentId, reason) {
  try {
    cancelPaymentTx(paymentId, reason);
    return { success: true, message: "Ödeme başarıyla iptal edildi." };
  } catch (err) {
    if (err instanceof DuesError) return { success: false, message: err.message };
    return { success: false, message: "Ödeme iptal edilemedi." };
  }
}

function getPaymentHistory(dueId) {
  try {
    const data = db
      .prepare(
        `SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.receipt_path, dp.note,
                dp.is_cancelled, dp.cancelled_at, dp.cancel_reason, dp.created_at,
                u.username AS collected_by_username
         FROM due_payments dp
         JOIN users u ON dp.collected_by = u.id
         WHERE dp.due_id = ?
         ORDER BY dp.created_at DESC`,
      )
      .all(dueId);
    return { success: true, data };
  } catch {
    return { success: false, message: "Ödeme geçmişi alınamadı." };
  }
}

module.exports = { getDuesForMonth, recordPayment, cancelPayment, getPaymentHistory };

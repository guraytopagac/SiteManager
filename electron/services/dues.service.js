const db = require("../../database/db");

class DuesError extends Error {}

const stmtInsertDue = db.prepare(`INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount) VALUES (?, ?, ?, ?)`);
const stmtGetApartments = db.prepare(`SELECT id, due_amount FROM apartments WHERE manager_id = ?`);

const getDuesTransaction = db.transaction((managerId, year, month) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentOrPast = year < currentYear || (year === currentYear && month <= currentMonth);

  if (isCurrentOrPast) {
    const apartments = stmtGetApartments.all(managerId);
    for (const apt of apartments) {
      stmtInsertDue.run(apt.id, year, month, apt.due_amount);
    }
  }

  return db
    .prepare(
      `SELECT d.id, d.apartment_id, d.year, d.month, d.due_amount, d.paid_amount, d.status,
              a.apartment_no, a.floor, a.type, a.square_meters,
              r.full_name AS resident_name, r.phone AS resident_phone, r.email AS resident_email
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
       WHERE a.manager_id = ? AND d.year = ? AND d.month = ?
       ORDER BY a.apartment_no ASC`,
    )
    .all(managerId, year, month);
});

function getDuesForMonth(managerId, year, month) {
  try {
    const data = getDuesTransaction(managerId, year, month);
    return { success: true, data };
  } catch (err) {
    return { success: false, message: "Aidat verileri alınamadı." };
  }
}

const recordPaymentTx = db.transaction((dueId, paymentData) => {
  const due = db
    .prepare(
      `SELECT d.id, d.due_amount, d.paid_amount, a.apartment_no
       FROM dues d JOIN apartments a ON d.apartment_id = a.id WHERE d.id = ?`,
    )
    .get(dueId);
  if (!due) throw new DuesError("Aidat kaydı bulunamadı.");

  if (!paymentData.amount || paymentData.amount <= 0)
    throw new DuesError("Ödeme tutarı sıfırdan büyük olmalıdır.");

  const remaining = parseFloat((due.due_amount - due.paid_amount).toFixed(2));
  if (paymentData.amount > remaining) {
    throw new DuesError(`Fazla ödeme yapılamaz. Kalan borç: ${remaining}₺`);
  }

  const { amount, payment_method, payment_date, note, collected_by } = paymentData;

  const paymentResult = db
    .prepare(
      `INSERT INTO due_payments (due_id, amount, payment_method, payment_date, note, collected_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(dueId, amount, payment_method, payment_date, note || null, collected_by);

  db.prepare(
    `INSERT INTO incomes (amount, date, description, category, manager_id, due_payment_id)
     VALUES (?, ?, ?, 'dues', ?, ?)`,
  ).run(amount, payment_date, `Aidat Ödemesi - Daire ${due.apartment_no}`, collected_by, paymentResult.lastInsertRowid);

  const newPaidAmount = parseFloat((due.paid_amount + amount).toFixed(2));
  const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

  db.prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(newPaidAmount, newStatus, dueId);
});

function recordPayment(dueId, paymentData) {
  try {
    recordPaymentTx(dueId, paymentData);
    return { success: true, message: "Ödeme başarıyla kaydedildi." };
  } catch (err) {
    if (err instanceof DuesError) return { success: false, message: err.message };
    return { success: false, message: `Ödeme kaydedilemedi: ${err.message}` };
  }
}

const cancelPaymentTx = db.transaction((paymentId, managerId, reason, cancelledBy) => {
  const payment = db
    .prepare(
      `SELECT dp.id, dp.due_id, dp.amount
       FROM due_payments dp
       JOIN dues d ON dp.due_id = d.id
       JOIN apartments a ON d.apartment_id = a.id
       WHERE dp.id = ? AND a.manager_id = ?`,
    )
    .get(paymentId, managerId);
  if (!payment) throw new DuesError("Ödeme kaydı bulunamadı.");

  const alreadyCancelled = db
    .prepare(`SELECT id FROM payment_cancellations WHERE payment_id = ?`)
    .get(paymentId);
  if (alreadyCancelled) throw new DuesError("Bu ödeme zaten iptal edilmiş.");

  db.prepare(
    `INSERT INTO payment_cancellations (payment_id, cancel_reason, cancelled_by) VALUES (?, ?, ?)`,
  ).run(paymentId, reason, cancelledBy);

  db.prepare(
    `UPDATE incomes SET is_cancelled = 1, cancelled_at = datetime('now'), cancel_reason = ?, cancelled_by = ?,
     updated_at = datetime('now') WHERE due_payment_id = ? AND is_cancelled = 0`,
  ).run(reason, cancelledBy, paymentId);

  const { total } = db
    .prepare(
      `SELECT COALESCE(SUM(dp.amount), 0) AS total
       FROM due_payments dp
       WHERE dp.due_id = ? AND NOT EXISTS (
         SELECT 1 FROM payment_cancellations pc WHERE pc.payment_id = dp.id
       )`,
    )
    .get(payment.due_id);

  const due = db.prepare(`SELECT due_amount FROM dues WHERE id = ?`).get(payment.due_id);
  const newPaidAmount = parseFloat(Number(total).toFixed(2));
  const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

  db.prepare(`UPDATE dues SET paid_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(newPaidAmount, newStatus, payment.due_id);
});

function cancelPayment(paymentId, managerId, reason, cancelledBy) {
  try {
    cancelPaymentTx(paymentId, managerId, reason, cancelledBy);
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
        `SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.note,
                dp.created_at,
                u.username AS collected_by_username,
                pc.cancel_reason, pc.cancelled_at,
                cu.username AS cancelled_by_username
         FROM due_payments dp
         JOIN users u ON dp.collected_by = u.id
         LEFT JOIN payment_cancellations pc ON pc.payment_id = dp.id
         LEFT JOIN users cu ON cu.id = pc.cancelled_by
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

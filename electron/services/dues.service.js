const db = require("../../database/db");

function ensureDuesForMonth(managerId, year, month) {
  return new Promise((resolve) => {
    db.all("SELECT id, due_amount FROM apartments WHERE manager_id = ?", [managerId], (err, apartments) => {
      if (err) return resolve({ success: false, message: "Daire listesi alınamadı." });
      if (!apartments.length) return resolve({ success: true });

      let pending = apartments.length;
      apartments.forEach((apt) => {
        db.run(
          `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount)
           VALUES (?, ?, ?, ?)`,
          [apt.id, year, month, apt.due_amount],
          (insertErr) => {
            if (insertErr) console.error("Due insert error:", insertErr.message);
            pending--;
            if (pending === 0) resolve({ success: true });
          },
        );
      });
    });
  });
}

function getDuesForMonth(managerId, year, month) {
  return new Promise(async (resolve) => {
    const ensureResult = await ensureDuesForMonth(managerId, year, month);
    if (!ensureResult.success) return resolve(ensureResult);

    const query = `
      SELECT d.id, d.apartment_id, d.year, d.month, d.due_amount, d.paid_amount, d.status,
             a.apartment_no, a.floor, a.type, a.square_meters
      FROM dues d
      JOIN apartments a ON d.apartment_id = a.id
      WHERE a.manager_id = ? AND d.year = ? AND d.month = ?
      ORDER BY a.apartment_no ASC
    `;

    db.all(query, [managerId, year, month], (err, rows) => {
      if (err) return resolve({ success: false, message: "Aidat verileri alınamadı." });
      resolve({ success: true, data: rows });
    });
  });
}

function recordPayment(dueId, paymentData) {
  return new Promise((resolve) => {
    db.get("SELECT id, due_amount, paid_amount FROM dues WHERE id = ?", [dueId], (err, due) => {
      if (err || !due) return resolve({ success: false, message: "Aidat kaydı bulunamadı." });

      const { amount, payment_method, payment_date, receipt_path, note, collected_by } = paymentData;

      db.run(
        `INSERT INTO due_payments (due_id, amount, payment_method, payment_date, receipt_path, note, collected_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dueId, amount, payment_method, payment_date, receipt_path || null, note || null, collected_by],
        function (insertErr) {
          if (insertErr) return resolve({ success: false, message: "Ödeme kaydedilemedi." });

          const newPaidAmount = parseFloat((due.paid_amount + amount).toFixed(2));
          const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

          db.run(
            `UPDATE dues SET paid_amount = ?, status = ? WHERE id = ?`,
            [newPaidAmount, newStatus, dueId],
            (updateErr) => {
              if (updateErr) return resolve({ success: false, message: "Aidat durumu güncellenemedi." });
              resolve({ success: true, message: "Ödeme başarıyla kaydedildi." });
            },
          );
        },
      );
    });
  });
}

function cancelPayment(paymentId, reason) {
  return new Promise((resolve) => {
    db.get("SELECT id, due_id, amount, is_cancelled FROM due_payments WHERE id = ?", [paymentId], (err, payment) => {
      if (err || !payment) return resolve({ success: false, message: "Ödeme kaydı bulunamadı." });
      if (payment.is_cancelled) return resolve({ success: false, message: "Bu ödeme zaten iptal edilmiş." });

      const cancelledAt = new Date().toISOString();

      db.run(
        `UPDATE due_payments SET is_cancelled = 1, cancelled_at = ?, cancel_reason = ? WHERE id = ?`,
        [cancelledAt, reason, paymentId],
        (cancelErr) => {
          if (cancelErr) return resolve({ success: false, message: "Ödeme iptal edilemedi." });

          // Recalculate paid_amount from non-cancelled payments
          db.get(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM due_payments WHERE due_id = ? AND is_cancelled = 0`,
            [payment.due_id],
            (sumErr, result) => {
              if (sumErr) return resolve({ success: false, message: "Tutar yeniden hesaplanamadı." });

              db.get("SELECT due_amount FROM dues WHERE id = ?", [payment.due_id], (dueErr, due) => {
                if (dueErr || !due) return resolve({ success: false, message: "Aidat kaydı bulunamadı." });

                const newPaidAmount = parseFloat(result.total.toFixed(2));
                const newStatus = newPaidAmount >= due.due_amount ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

                db.run(
                  `UPDATE dues SET paid_amount = ?, status = ? WHERE id = ?`,
                  [newPaidAmount, newStatus, payment.due_id],
                  (updateErr) => {
                    if (updateErr) return resolve({ success: false, message: "Aidat durumu güncellenemedi." });
                    resolve({ success: true, message: "Ödeme başarıyla iptal edildi." });
                  },
                );
              });
            },
          );
        },
      );
    });
  });
}

function getPaymentHistory(dueId) {
  return new Promise((resolve) => {
    const query = `
      SELECT dp.id, dp.amount, dp.payment_method, dp.payment_date, dp.receipt_path, dp.note,
             dp.is_cancelled, dp.cancelled_at, dp.cancel_reason, dp.created_at,
             u.username AS collected_by_username
      FROM due_payments dp
      JOIN users u ON dp.collected_by = u.id
      WHERE dp.due_id = ?
      ORDER BY dp.created_at DESC
    `;

    db.all(query, [dueId], (err, rows) => {
      if (err) return resolve({ success: false, message: "Ödeme geçmişi alınamadı." });
      resolve({ success: true, data: rows });
    });
  });
}

module.exports = { getDuesForMonth, recordPayment, cancelPayment, getPaymentHistory };

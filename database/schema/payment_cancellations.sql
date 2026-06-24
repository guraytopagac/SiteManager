-- Payment cancellations table: audit log for cancelled due payments.
-- UNIQUE(payment_id) enforces that a payment can only be cancelled once.
-- The original due_payments row is never deleted; this table adds the cancellation record.
-- ON DELETE RESTRICT on payment_id prevents removing a payment that has been cancelled.
CREATE TABLE IF NOT EXISTS payment_cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cancelled_at TEXT NOT NULL DEFAULT (datetime('now')) CHECK(datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT NOT NULL CHECK(length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300),
  payment_id INTEGER NOT NULL UNIQUE,
  cancelled_by INTEGER NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT -- kullanıcı soft-delete ile devre dışı bırakılır, fiziksel silme yapılmaz
);

-- Prevent any modification of cancellation records; this is an immutable audit log
CREATE TRIGGER IF NOT EXISTS trg_payment_cancellations_immutable
  BEFORE UPDATE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records are immutable.');
END;

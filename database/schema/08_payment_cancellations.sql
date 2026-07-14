CREATE TABLE IF NOT EXISTS payment_cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cancelled_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')) CHECK(datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT NOT NULL CHECK(length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300),
  payment_id INTEGER NOT NULL UNIQUE,
  cancelled_by INTEGER NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS trg_payment_cancellations_immutable
  BEFORE UPDATE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records are immutable.');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_cancellations_no_delete
  BEFORE DELETE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records cannot be deleted.');
END;

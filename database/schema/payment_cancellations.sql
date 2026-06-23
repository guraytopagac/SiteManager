-- Payment cancellations table: audit log for cancelled due payments.
-- UNIQUE(payment_id) enforces that a payment can only be cancelled once.
-- The original due_payments row is never deleted; this table adds the cancellation record.
-- ON DELETE RESTRICT on payment_id prevents removing a payment that has been cancelled.
CREATE TABLE IF NOT EXISTS payment_cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cancelled_at TEXT NOT NULL DEFAULT (datetime('now')) CHECK(date(cancelled_at) IS NOT NULL),
  cancel_reason TEXT NOT NULL CHECK(length(trim(cancel_reason)) > 0),
  created_at TEXT DEFAULT (datetime('now')),

  payment_id INTEGER NOT NULL UNIQUE,
  cancelled_by INTEGER NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

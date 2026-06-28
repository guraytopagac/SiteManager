-- Due payments table: records each payment transaction against a dues entry.
-- A dues record can have multiple payments (e.g. partial payments over time).
-- Cancellation is tracked in the separate payment_cancellations table — rows here are never deleted.
-- amount is capped at 50,000 to prevent data entry errors.
-- collected_by references the user who recorded the payment.
CREATE TABLE IF NOT EXISTS due_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  due_id INTEGER NOT NULL,
  collected_by INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 50000),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  payment_date TEXT NOT NULL CHECK(
    date(payment_date) IS NOT NULL AND
    date(payment_date) >= '2000-01-01'
  ),
  note TEXT CHECK(note IS NULL OR length(note) <= 500),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(due_id) REFERENCES dues(id) ON DELETE RESTRICT,
  FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_due_payments_due_id ON due_payments(due_id);

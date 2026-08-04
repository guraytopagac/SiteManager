CREATE TABLE IF NOT EXISTS due_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  due_id INTEGER NOT NULL,
  collected_by INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  payment_date TEXT NOT NULL CHECK(
    date(payment_date) IS NOT NULL AND
    payment_date >= '2000-01-01' AND
    payment_date <= '2100-12-31'
  ),
  note TEXT CHECK(note IS NULL OR (length(trim(note)) > 0 AND length(note) <= 500)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(due_id) REFERENCES dues(id) ON DELETE RESTRICT,
  FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_due_payments_due_id ON due_payments(due_id);

CREATE TRIGGER IF NOT EXISTS trg_due_payments_no_delete
  BEFORE DELETE ON due_payments FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment records cannot be deleted.');
END;

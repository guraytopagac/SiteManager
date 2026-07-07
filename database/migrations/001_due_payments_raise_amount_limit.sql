CREATE TABLE due_payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  due_id INTEGER NOT NULL,
  collected_by INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
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

INSERT INTO due_payments_new SELECT * FROM due_payments;

DROP TABLE due_payments;

ALTER TABLE due_payments_new RENAME TO due_payments;

CREATE INDEX IF NOT EXISTS idx_due_payments_due_id ON due_payments(due_id);

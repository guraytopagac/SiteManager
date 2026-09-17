-- A payment can now carry a receipt file. ALTER TABLE cannot add the CHECK binding name and blob, so the
-- table is rebuilt in the documented order: build under a temporary name, drop the old one, then rename,
-- which leaves the due_payments references in payment_cancellations and incomes intact.
CREATE TABLE new_due_payments (
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
  receipt_name TEXT CHECK(
    receipt_name IS NULL OR (
      length(trim(receipt_name)) > 0 AND
      length(receipt_name) <= 150 AND
      (
        lower(receipt_name) GLOB '*.pdf' OR
        lower(receipt_name) GLOB '*.jpg' OR
        lower(receipt_name) GLOB '*.jpeg' OR
        lower(receipt_name) GLOB '*.png' OR
        lower(receipt_name) GLOB '*.webp'
      )
    )
  ),
  receipt_blob BLOB CHECK(receipt_blob IS NULL OR length(receipt_blob) <= 5242880),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  CHECK(
    (receipt_name IS NULL AND receipt_blob IS NULL) OR
    (receipt_name IS NOT NULL AND receipt_blob IS NOT NULL)
  ),
  FOREIGN KEY(due_id) REFERENCES dues(id) ON DELETE RESTRICT,
  FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE RESTRICT
);

INSERT INTO new_due_payments (id, due_id, collected_by, amount, payment_method, payment_date, note, created_at)
  SELECT id, due_id, collected_by, amount, payment_method, payment_date, note, created_at FROM due_payments;

-- The delete guard has to go first, or dropping the old table is refused.
DROP TRIGGER IF EXISTS trg_due_payments_no_delete;
DROP INDEX IF EXISTS idx_due_payments_due_id;
DROP TABLE due_payments;

ALTER TABLE new_due_payments RENAME TO due_payments;

CREATE INDEX IF NOT EXISTS idx_due_payments_due_id ON due_payments(due_id);

CREATE TRIGGER IF NOT EXISTS trg_due_payments_no_delete
  BEFORE DELETE ON due_payments FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment records cannot be deleted.');
END;

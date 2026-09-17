-- Reworks the manual income categories: adds utility_share for metered water and heating shares, drops
-- donation and moves its rows to other. The table is rebuilt, since SQLite cannot alter a CHECK in place,
-- and its indexes and triggers are created again below.
DROP TRIGGER IF EXISTS trg_incomes_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_incomes_no_delete;

ALTER TABLE incomes RENAME TO incomes_old;

CREATE TABLE incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  due_payment_id INTEGER UNIQUE,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 500)),
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'dues', 'rent', 'parking', 'utility_share', 'special_fee', 'penalty', 'other'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  payer_name TEXT CHECK(payer_name IS NULL OR (length(trim(payer_name)) > 0 AND length(payer_name) <= 60)),
  payment_method TEXT CHECK(payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

INSERT INTO incomes (
  id, building_id, due_payment_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at,
  payer_name, payment_method
)
SELECT
  id, building_id, due_payment_id, amount, date, description,
  CASE WHEN category = 'donation' THEN 'other' ELSE category END,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at,
  payer_name, payment_method
FROM incomes_old;

DROP TABLE incomes_old;

CREATE INDEX IF NOT EXISTS idx_incomes_building_date ON incomes(building_id, date);
CREATE INDEX IF NOT EXISTS idx_incomes_active_only ON incomes(building_id, date) WHERE is_cancelled = 0;

CREATE TRIGGER IF NOT EXISTS trg_incomes_prevent_update_after_cancel
  BEFORE UPDATE ON incomes FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled income records cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS trg_incomes_no_delete
  BEFORE DELETE ON incomes FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Income records cannot be deleted.');
END;

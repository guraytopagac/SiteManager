-- Income ledger of a building. Dues income is written only by recordPayment.
CREATE TABLE IF NOT EXISTS incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  -- Set for dues income only. UNIQUE keeps it to one income row per payment.
  due_payment_id INTEGER UNIQUE,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0 AND length(description) <= 500),
  -- The dues category is kept for recordPayment. The handler rejects it on manual entry.
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('dues', 'rent', 'parking', 'donation', 'other')),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  -- The four cancel fields are either all NULL or all filled.
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_incomes_building_date ON incomes(building_id, date);
-- Partial index for the common case. Reports and totals read only non-cancelled rows.
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

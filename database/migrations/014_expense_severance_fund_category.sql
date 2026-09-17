-- Adds the severance_fund expense category, written only by the severance fund transfers. The table is
-- rebuilt, since SQLite cannot alter a CHECK in place, and its indexes and triggers are created again below.
-- The three severance fund tables are new, so the schema step creates them.
DROP TRIGGER IF EXISTS trg_expenses_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_expenses_no_delete;

ALTER TABLE expenses RENAME TO expenses_old;

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 500)),
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'maintenance', 'cleaning', 'utility', 'heating', 'staff', 'other', 'severance_fund'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  vendor_name TEXT CHECK(vendor_name IS NULL OR (length(trim(vendor_name)) > 0 AND length(vendor_name) <= 100)),
  vendor_address TEXT CHECK(vendor_address IS NULL OR (length(trim(vendor_address)) > 0 AND length(vendor_address) <= 300)),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

INSERT INTO expenses (
  id, building_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at,
  vendor_name, vendor_address
)
SELECT
  id, building_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at,
  vendor_name, vendor_address
FROM expenses_old;

DROP TABLE expenses_old;

CREATE INDEX IF NOT EXISTS idx_expenses_building_date ON expenses(building_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_active_only ON expenses(building_id, date) WHERE is_cancelled = 0;

CREATE TRIGGER IF NOT EXISTS trg_expenses_prevent_update_after_cancel
  BEFORE UPDATE ON expenses FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled expense records cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_no_delete
  BEFORE DELETE ON expenses FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Expense records cannot be deleted.');
END;

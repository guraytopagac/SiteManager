-- Expenses table: records all expense entries (maintenance, cleaning, utility, staff, other).
-- Records are never deleted; cancellation is done via is_cancelled flag + cancelled_by/at/reason.
-- Cancellation CHECK constraint ensures all four cancellation fields are set together or not at all.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(date(date) IS NOT NULL AND date >= '2000-01-01'),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0 AND length(description) <= 500),
  category TEXT DEFAULT 'other' CHECK(category IN ('maintenance', 'cleaning', 'utility', 'staff', 'other')),
  is_cancelled INTEGER DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  -- All cancellation fields must be set together or left null
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_expenses_manager_date ON expenses(manager_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_active_only ON expenses(manager_id, date) WHERE is_cancelled = 0;

-- Prevent modification of cancelled expense records
CREATE TRIGGER IF NOT EXISTS trg_expenses_prevent_update_after_cancel
  BEFORE UPDATE ON expenses FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled expense records cannot be modified.');
END;

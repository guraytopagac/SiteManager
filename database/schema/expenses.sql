-- Expenses table: records all expense entries (maintenance, cleaning, utility, staff, other).
-- Records are never deleted; cancellation is done via is_cancelled flag + cancelled_by/at/reason.
-- Cancellation CHECK constraint ensures all four cancellation fields are set together or not at all.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(date(date) IS NOT NULL),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  category TEXT DEFAULT 'other' CHECK(category IN ('maintenance', 'cleaning', 'utility', 'staff', 'other')),
  is_cancelled INTEGER DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR date(cancelled_at) IS NOT NULL),
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  manager_id INTEGER NOT NULL,
  cancelled_by INTEGER,
  -- All cancellation fields must be set together or left null
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_manager_id ON expenses(manager_id);

-- Auto-update updated_at on any row change
CREATE TRIGGER IF NOT EXISTS trg_expenses_updated_at
  AFTER UPDATE ON expenses FOR EACH ROW
BEGIN
  UPDATE expenses SET updated_at = datetime('now') WHERE id = NEW.id;
END;

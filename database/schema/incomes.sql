-- Incomes table: records all income entries (dues, rent, other).
-- Records are never deleted; cancellation is done via is_cancelled flag + cancelled_by/at/reason.
-- Cancellation CHECK constraint ensures all four cancellation fields are set together or not at all.
-- due_payment_id optionally links an income record to a specific dues payment.
CREATE TABLE IF NOT EXISTS incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(date(date) IS NOT NULL),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  category TEXT DEFAULT 'other' CHECK(category IN ('dues', 'rent', 'other')),
  is_cancelled INTEGER DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR date(cancelled_at) IS NOT NULL),
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  manager_id INTEGER NOT NULL,
  due_payment_id INTEGER,
  cancelled_by INTEGER,
  -- All cancellation fields must be set together or left null
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE SET NULL,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_incomes_manager_id ON incomes(manager_id);

-- Auto-update updated_at on any row change
CREATE TRIGGER IF NOT EXISTS trg_incomes_updated_at
  AFTER UPDATE ON incomes FOR EACH ROW
BEGIN
  UPDATE incomes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Money moved between the two accounts of the main cash, cash on hand and the bank. A transfer is neither
-- income nor expense: the total stays the same, only the split changes. Same cancel rules as incomes.
CREATE TABLE IF NOT EXISTS cash_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  -- The account the money went into. It left the other one, so bank is a deposit and cash a withdrawal.
  to_account TEXT NOT NULL CHECK(to_account IN ('cash', 'bank')),
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 300)),
  recorded_by INTEGER NOT NULL,
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
  FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cash_transfers_building_date ON cash_transfers(building_id, date);

CREATE TRIGGER IF NOT EXISTS trg_cash_transfers_prevent_update_after_cancel
  BEFORE UPDATE ON cash_transfers FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled cash transfers cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS trg_cash_transfers_no_delete
  BEFORE DELETE ON cash_transfers FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Cash transfers cannot be deleted.');
END;

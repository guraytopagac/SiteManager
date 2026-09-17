-- Severance paid to an employee out of the fund. Never deleted, only cancelled.
CREATE TABLE IF NOT EXISTS severance_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 5000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  note TEXT CHECK(note IS NULL OR (length(trim(note)) > 0 AND length(note) <= 300)),
  -- Set when the fund was short and the difference came from the main cash in the same step. It points at
  -- that severance_fund expense, which is how a top-up is told apart from a monthly transfer.
  top_up_expense_id INTEGER UNIQUE,
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
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY(top_up_expense_id) REFERENCES expenses(id) ON DELETE RESTRICT,
  FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_severance_payouts_building ON severance_payouts(building_id, date);
-- An employee is paid once. A cancelled payout frees the slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_severance_payouts_active_employee
  ON severance_payouts(employee_id) WHERE is_cancelled = 0;

CREATE TRIGGER IF NOT EXISTS trg_severance_payouts_prevent_update_after_cancel
  BEFORE UPDATE ON severance_payouts FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled severance payouts cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS trg_severance_payouts_no_delete
  BEFORE DELETE ON severance_payouts FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Severance payouts cannot be deleted.');
END;

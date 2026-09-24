-- Adds the dues_refund expense category: prepaid dues handed back to whoever paid them, written only by
-- refundPrepayment. SQLite cannot alter a CHECK in place, so the table is rebuilt the same way as in
-- 016_transaction_category_set.sql. The new table is filled and then renamed over the old one, because
-- renaming the old table away would also rewrite the foreign keys pointing at it. Indexes and triggers go
-- with the dropped table and are created again.

DROP TRIGGER IF EXISTS trg_expenses_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_expenses_no_delete;

CREATE TABLE expenses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 500)),
  -- The severance_fund category is a transfer into the severance fund, entered by hand or written as the
  -- top-up of a payout. A staff_advance is money lent to an employee and paid back as an income. A
  -- dues_refund is prepaid dues handed back and is written only by refundPrepayment.
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'electricity', 'water', 'utility', 'heating',
      'elevator', 'garden', 'maintenance', 'equipment', 'cleaning',
      'staff', 'staff_insurance', 'staff_advance', 'severance_fund',
      'bank_fee', 'building_insurance', 'legal', 'office', 'management',
      'dues_refund', 'other'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  -- Printed on the expense voucher. A vendor can be a firm, so the name allows more than a person's.
  vendor_name TEXT CHECK(vendor_name IS NULL OR (length(trim(vendor_name)) > 0 AND length(vendor_name) <= 100)),
  vendor_address TEXT CHECK(vendor_address IS NULL OR (length(trim(vendor_address)) > 0 AND length(vendor_address) <= 300)),
  -- The part of the main cash the money was paid from. The default only serves the column added to an
  -- existing table.
  account TEXT NOT NULL DEFAULT 'cash' CHECK(account IN ('cash', 'bank')),
  -- Marks an expense paid out of the investment fund. It does not change the category, a roof job stays a
  -- maintenance expense: the flag only says which pot the money came from. The default only serves the
  -- column added to an existing table.
  is_investment INTEGER NOT NULL DEFAULT 0 CHECK(is_investment IN (0, 1)),
  -- The employee an advance was given to. Set for that category and for no other.
  employee_id INTEGER,
  CHECK((category = 'staff_advance') = (employee_id IS NOT NULL)),
  -- Neither a transfer into the severance fund, a staff advance nor a dues refund comes out of the
  -- investment fund, each belongs to a ledger of its own.
  CHECK(is_investment = 0 OR category NOT IN ('severance_fund', 'staff_advance', 'dues_refund')),
  -- The four cancel fields are either all NULL or all filled.
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

INSERT INTO expenses_new (id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account, is_investment, employee_id)
SELECT id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account, is_investment, employee_id
FROM expenses;

DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;

CREATE INDEX IF NOT EXISTS idx_expenses_building_date ON expenses(building_id, date);
-- Partial index for the common case. Reports and totals read only non-cancelled rows.
CREATE INDEX IF NOT EXISTS idx_expenses_active_only ON expenses(building_id, date) WHERE is_cancelled = 0;
CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id) WHERE employee_id IS NOT NULL;

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

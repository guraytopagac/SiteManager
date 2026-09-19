-- Adds the staff advance. An advance is an expense of the staff_advance category, a repayment is an income of
-- the advance_repayment category, and both name the employee in the new employee_id column. The open advance
-- of an employee is derived from the two, so nothing else is stored. There is no automatic deduction: the
-- employee pays back whenever it suits them.
-- SQLite cannot alter a CHECK in place, so both tables are rebuilt the same way as in
-- 016_transaction_category_set.sql. Indexes and triggers go with the dropped table and are created again.

DROP TRIGGER IF EXISTS trg_incomes_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_incomes_no_delete;

CREATE TABLE incomes_new (
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
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 500)),
  -- The dues category is kept for recordPayment. The handler rejects it on manual entry.
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'dues', 'rent', 'parking', 'utility_share', 'special_fee', 'penalty', 'interest', 'advance_repayment', 'other'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  -- Name printed as the payer on the receipt of a manual income. A dues receipt always names the
  -- apartment's resident for that month, so this stays NULL there.
  payer_name TEXT CHECK(payer_name IS NULL OR (length(trim(payer_name)) > 0 AND length(payer_name) <= 60)),
  -- Written for manual income only, when the income is entered. A dues income reads its method from
  -- the payment row. Rows entered before the column existed stay NULL and print no method.
  payment_method TEXT CHECK(payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  -- The part of the main cash the money landed in. It follows the payment method: a bank transfer or a card
  -- goes to the bank, the rest stays in hand. The default only serves the column added to an existing table.
  account TEXT NOT NULL DEFAULT 'cash' CHECK(account IN ('cash', 'bank')),
  -- The employee paying back an advance. Set for that category and for no other.
  employee_id INTEGER,
  CHECK((category = 'advance_repayment') = (employee_id IS NOT NULL)),
  -- The four cancel fields are either all NULL or all filled.
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

INSERT INTO incomes_new (id, building_id, due_payment_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, payer_name, payment_method, account)
SELECT id, building_id, due_payment_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, payer_name, payment_method, account
FROM incomes;

DROP TABLE incomes;
ALTER TABLE incomes_new RENAME TO incomes;

CREATE INDEX IF NOT EXISTS idx_incomes_building_date ON incomes(building_id, date);
-- Partial index for the common case. Reports and totals read only non-cancelled rows.
CREATE INDEX IF NOT EXISTS idx_incomes_active_only ON incomes(building_id, date) WHERE is_cancelled = 0;
CREATE INDEX IF NOT EXISTS idx_incomes_employee ON incomes(employee_id) WHERE employee_id IS NOT NULL;

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
  -- top-up of a payout. A staff_advance is money lent to an employee and paid back as an income.
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'electricity', 'water', 'utility', 'heating',
      'elevator', 'garden', 'maintenance', 'equipment', 'cleaning',
      'staff', 'staff_insurance', 'staff_advance', 'severance_fund',
      'bank_fee', 'building_insurance', 'legal', 'office', 'management',
      'other'
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
  -- The employee an advance was given to. Set for that category and for no other.
  employee_id INTEGER,
  CHECK((category = 'staff_advance') = (employee_id IS NOT NULL)),
  -- The four cancel fields are either all NULL or all filled.
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

INSERT INTO expenses_new (id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account)
SELECT id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account
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

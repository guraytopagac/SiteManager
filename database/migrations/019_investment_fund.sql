-- Adds the investment fund. The fund itself is a new table created by the schema stage, this file only
-- widens the three tables it leans on. A due row now carries a due_type, so an apartment can owe both its
-- monthly dues and a fund contribution for the same month and the unique key grows to match. Every row
-- that exists today is a regular due. Income gains the investment_dues category, written only by
-- recordPayment, and an expense gains the is_investment flag that says it was paid out of the fund.
-- SQLite cannot alter a CHECK in place, so all three tables are rebuilt the same way as in
-- 016_transaction_category_set.sql. The new table is filled and then renamed over the old one, because
-- renaming the old table away would also rewrite the foreign keys pointing at it. Indexes and triggers go
-- with the dropped table and are created again.

DROP TRIGGER IF EXISTS trg_dues_no_delete;

CREATE TABLE dues_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  -- Which charge the row carries. A regular row is the monthly dues of the apartment and is owed by
  -- whoever lives there, an investment row is the fund contribution and is owed by the owner. The two
  -- accrue from different sources and are read on different pages, so an apartment can hold one of each
  -- per month. The default only serves the column added to an existing table, both accruals write it.
  due_type TEXT NOT NULL DEFAULT 'regular' CHECK(due_type IN ('regular', 'investment')),
  -- Copy of the amount at accrual time: apartments.due_amount for a regular row, the building's
  -- investment_funds.monthly_amount for an investment one. It stays fixed after that.
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  -- Recomputed as the sum of the active payments.
  paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= due_amount),
  -- Comes from paid_amount and is tied to it here. Same rule as calcDueStatus in dues/service.js.
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(
    status = CASE
      WHEN paid_amount >= due_amount THEN 'paid'
      WHEN paid_amount > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE RESTRICT,
  UNIQUE(apartment_id, year, month, due_type)
);

INSERT INTO dues_new (id, apartment_id, year, month, due_type, due_amount, paid_amount, status, created_at, updated_at)
SELECT id, apartment_id, year, month, 'regular', due_amount, paid_amount, status, created_at, updated_at
FROM dues;

DROP TABLE dues;
ALTER TABLE dues_new RENAME TO dues;

CREATE TRIGGER IF NOT EXISTS trg_dues_no_delete
  BEFORE DELETE ON dues FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Due records cannot be deleted.');
END;

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
  -- The dues and investment_dues categories are written only by recordPayment, one for the monthly dues
  -- and one for the investment fund. The handler rejects both on manual entry.
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'dues', 'investment_dues', 'rent', 'parking', 'utility_share', 'special_fee', 'penalty', 'interest',
      'advance_repayment', 'other'
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

INSERT INTO incomes_new (id, building_id, due_payment_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, payer_name, payment_method, account, employee_id)
SELECT id, building_id, due_payment_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, payer_name, payment_method, account, employee_id
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
  -- Marks an expense paid out of the investment fund. It does not change the category, a roof job stays a
  -- maintenance expense: the flag only says which pot the money came from. The default only serves the
  -- column added to an existing table.
  is_investment INTEGER NOT NULL DEFAULT 0 CHECK(is_investment IN (0, 1)),
  -- The employee an advance was given to. Set for that category and for no other.
  employee_id INTEGER,
  CHECK((category = 'staff_advance') = (employee_id IS NOT NULL)),
  -- Neither a transfer into the severance fund nor a staff advance comes out of the investment fund,
  -- both belong to a ledger of their own.
  CHECK(is_investment = 0 OR category NOT IN ('severance_fund', 'staff_advance')),
  -- The four cancel fields are either all NULL or all filled.
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

INSERT INTO expenses_new (id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account, employee_id)
SELECT id, building_id, amount, date, description, category, is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at, vendor_name, vendor_address, account, employee_id
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

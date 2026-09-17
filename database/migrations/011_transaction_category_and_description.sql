-- Widens the category CHECK on incomes and expenses and makes description optional. Both tables are
-- rebuilt, and each gets its indexes and triggers back since DROP TABLE takes them.
DROP TRIGGER IF EXISTS trg_incomes_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_incomes_no_delete;

ALTER TABLE incomes RENAME TO incomes_old;

CREATE TABLE incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  due_payment_id INTEGER UNIQUE,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(
    date(date) IS NOT NULL AND
    date >= '2000-01-01' AND
    date <= '2100-12-31'
  ),
  description TEXT CHECK(description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 500)),
  category TEXT NOT NULL DEFAULT 'other' CHECK(
    category IN (
      'dues', 'rent', 'parking', 'special_fee', 'penalty', 'donation', 'other'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

INSERT INTO incomes (
  id, building_id, due_payment_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at
)
SELECT
  id, building_id, due_payment_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at
FROM incomes_old;

DROP TABLE incomes_old;

CREATE INDEX IF NOT EXISTS idx_incomes_building_date ON incomes(building_id, date);
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
      'maintenance', 'cleaning', 'utility', 'heating', 'staff', 'other'
    )
  ),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);

INSERT INTO expenses (
  id, building_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at
)
SELECT
  id, building_id, amount, date, description, category,
  is_cancelled, cancelled_at, cancel_reason, cancelled_by, created_at, updated_at
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

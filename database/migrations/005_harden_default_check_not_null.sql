CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK(
    length(username) >= 3 AND
    username GLOB '[A-Za-z0-9_]*'
  ),
  email TEXT UNIQUE NOT NULL CHECK(email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT,
  role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login TEXT CHECK(last_login IS NULL OR datetime(last_login) IS NOT NULL),
  password_changed_at TEXT CHECK(
    password_changed_at IS NULL OR
    datetime(password_changed_at) IS NOT NULL
  ),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
  AFTER UPDATE ON users FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE residents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT,
  phone TEXT CHECK(phone IS NULL OR (length(phone) >= 10 AND phone NOT GLOB '*[^0-9+()- ]*')),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) >= 5)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id NOT GLOB '*[^0-9]*')),
  resident_type TEXT CHECK(resident_type IS NULL OR resident_type IN ('owner', 'tenant')),
  move_in_date TEXT CHECK(move_in_date IS NULL OR date(move_in_date) IS NOT NULL),
  move_out_date TEXT CHECK(
    move_out_date IS NULL OR
    (date(move_out_date) IS NOT NULL AND (
      move_in_date IS NULL OR
      move_out_date >= move_in_date
    ))
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  apartment_id INTEGER NOT NULL,
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
);
INSERT INTO residents_new SELECT * FROM residents;
DROP TABLE residents;
ALTER TABLE residents_new RENAME TO residents;
CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);
CREATE TRIGGER IF NOT EXISTS trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_residents_move_out_insert
  AFTER INSERT ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TABLE dues_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= due_amount),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE(apartment_id, year, month)
);
INSERT INTO dues_new SELECT * FROM dues;
DROP TABLE dues;
ALTER TABLE dues_new RENAME TO dues;
CREATE TRIGGER IF NOT EXISTS trg_dues_updated_at
  AFTER UPDATE ON dues FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE dues SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE incomes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL,
  due_payment_id INTEGER UNIQUE,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(date(date) IS NOT NULL AND date >= '2000-01-01'),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0 AND length(description) <= 500),
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('dues', 'other')),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(due_payment_id) REFERENCES due_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);
INSERT INTO incomes_new SELECT * FROM incomes;
DROP TABLE incomes;
ALTER TABLE incomes_new RENAME TO incomes;
CREATE INDEX IF NOT EXISTS idx_incomes_manager_date ON incomes(manager_id, date);
CREATE INDEX IF NOT EXISTS idx_incomes_active_only ON incomes(manager_id, date) WHERE is_cancelled = 0;
CREATE TRIGGER IF NOT EXISTS trg_incomes_prevent_update_after_cancel
  BEFORE UPDATE ON incomes FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled income records cannot be modified.');
END;

CREATE TABLE expenses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0 AND amount <= 1000000),
  date TEXT NOT NULL CHECK(date(date) IS NOT NULL AND date >= '2000-01-01'),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0 AND length(description) <= 500),
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('maintenance', 'cleaning', 'utility', 'staff', 'other')),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT CHECK(cancelled_at IS NULL OR datetime(cancelled_at) IS NOT NULL),
  cancel_reason TEXT CHECK(cancel_reason IS NULL OR (length(trim(cancel_reason)) > 0 AND length(cancel_reason) <= 300)),
  cancelled_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK(
    (is_cancelled = 0 AND cancelled_at IS NULL AND cancel_reason IS NULL AND cancelled_by IS NULL) OR
    (is_cancelled = 1 AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT
);
INSERT INTO expenses_new SELECT * FROM expenses;
DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;
CREATE INDEX IF NOT EXISTS idx_expenses_manager_date ON expenses(manager_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_active_only ON expenses(manager_id, date) WHERE is_cancelled = 0;
CREATE TRIGGER IF NOT EXISTS trg_expenses_prevent_update_after_cancel
  BEFORE UPDATE ON expenses FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled expense records cannot be modified.');
END;

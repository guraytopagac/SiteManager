-- Dues table: one record per apartment per month.
-- UNIQUE(apartment_id, year, month) prevents duplicate dues entries.
-- paid_amount must not exceed due_amount (enforced by CHECK constraint).
-- Records are never deleted; only edited or paid.
CREATE TABLE IF NOT EXISTS dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  paid_amount REAL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= due_amount),
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE(apartment_id, year, month)
);

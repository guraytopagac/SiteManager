CREATE TABLE IF NOT EXISTS dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= due_amount),
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
  UNIQUE(apartment_id, year, month)
);

CREATE TRIGGER IF NOT EXISTS trg_dues_no_delete
  BEFORE DELETE ON dues FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Due records cannot be deleted.');
END;

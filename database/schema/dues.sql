-- Dues table: one record per apartment per month.
-- UNIQUE(apartment_id, year, month) prevents duplicate dues entries.
-- status is derived automatically by trigger — do not set it manually.
-- paid_amount must not exceed due_amount (enforced by CHECK + trigger).
-- Records are never deleted; only edited or paid.
CREATE TABLE IF NOT EXISTS dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  due_amount REAL NOT NULL CHECK(due_amount > 0),
  paid_amount REAL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= due_amount),
  due_date TEXT CHECK(due_date IS NULL OR date(due_date) IS NOT NULL),
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  apartment_id INTEGER NOT NULL,
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE(apartment_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_dues_status ON dues(status);
CREATE INDEX IF NOT EXISTS idx_dues_year_month ON dues(year, month);

-- Auto-update updated_at on any row change
CREATE TRIGGER IF NOT EXISTS trg_dues_updated_at
  AFTER UPDATE ON dues FOR EACH ROW
BEGIN
  UPDATE dues SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Recalculate status whenever paid_amount or due_amount changes
CREATE TRIGGER IF NOT EXISTS trg_dues_status
  AFTER UPDATE OF paid_amount, due_amount ON dues FOR EACH ROW
BEGIN
  UPDATE dues SET
    status = CASE
      WHEN NEW.paid_amount >= NEW.due_amount THEN 'paid'
      WHEN NEW.paid_amount > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  WHERE id = NEW.id;
END;

-- Prevent due_amount from being lowered below the already-paid amount
CREATE TRIGGER IF NOT EXISTS trg_dues_due_amount_check
  AFTER UPDATE OF due_amount ON dues FOR EACH ROW
  WHEN NEW.paid_amount > NEW.due_amount
BEGIN
  SELECT RAISE(ABORT, 'paid_amount cannot exceed due_amount.');
END;

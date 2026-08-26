-- Adds the 2000-01-01..2100-12-31 range check to the resident date columns.
-- SQLite cannot ALTER a CHECK, so the table is rebuilt.

CREATE TABLE residents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  full_name TEXT CHECK(full_name IS NULL OR (length(trim(full_name)) > 0 AND length(full_name) <= 60)),
  phone TEXT CHECK(phone IS NULL OR (
    length(phone) BETWEEN 10 AND 20 AND
    length(trim(phone)) > 0 AND
    phone NOT GLOB '*[^0-9+()- ]*'
  )),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id NOT GLOB '*[^0-9]*')),
  resident_type TEXT CHECK(resident_type IS NULL OR resident_type IN ('owner', 'tenant')),
  move_in_date TEXT CHECK(move_in_date IS NULL OR (
    date(move_in_date) IS NOT NULL AND
    move_in_date >= '2000-01-01' AND
    move_in_date <= '2100-12-31'
  )),
  move_out_date TEXT CHECK(
    move_out_date IS NULL OR
    (date(move_out_date) IS NOT NULL AND
     move_out_date >= '2000-01-01' AND
     move_out_date <= '2100-12-31' AND (
      move_in_date IS NULL OR
      move_out_date >= move_in_date
    ))
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes TEXT CHECK(notes IS NULL OR (length(trim(notes)) > 0 AND length(notes) <= 500)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
);

-- Old values outside the range become NULL, so this cannot stop the app from opening.
INSERT INTO residents_new (
  id, apartment_id, full_name, phone, email, national_id, resident_type,
  move_in_date, move_out_date, is_active, notes, created_at, updated_at
)
SELECT
  id, apartment_id, full_name, phone, email, national_id, resident_type,
  CASE WHEN move_in_date >= '2000-01-01' AND move_in_date <= '2100-12-31' THEN move_in_date END,
  CASE WHEN move_out_date >= '2000-01-01' AND move_out_date <= '2100-12-31' THEN move_out_date END,
  is_active, notes, created_at, updated_at
FROM residents;

-- DROP TABLE also drops the index and the triggers, so both are created again below.
DROP TABLE residents;

ALTER TABLE residents_new RENAME TO residents;

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

CREATE TRIGGER IF NOT EXISTS trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_residents_move_out_insert
  AFTER INSERT ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

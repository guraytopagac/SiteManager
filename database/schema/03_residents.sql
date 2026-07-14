CREATE TABLE IF NOT EXISTS residents (
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
  created_at TEXT DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
  apartment_id INTEGER NOT NULL,
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
);

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

-- Residents table: tracks current and past occupants of each apartment.
-- An apartment can have multiple residents over time; is_active=1 marks the current one.
-- national_id must be exactly 11 digits (Turkish TC kimlik format).
-- move_out_date must be >= move_in_date when both are set.
-- Deleting an apartment cascades to all its resident records.
CREATE TABLE IF NOT EXISTS residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT CHECK(phone IS NULL OR (length(phone) >= 10 AND phone GLOB '[0-9+()- ]*')),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) >= 5)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id GLOB '[0-9]*')),
  resident_type TEXT DEFAULT 'tenant' CHECK(resident_type IN ('owner', 'tenant')),
  move_in_date TEXT CHECK(move_in_date IS NULL OR date(move_in_date) IS NOT NULL),
  move_out_date TEXT CHECK(
    move_out_date IS NULL OR
    (date(move_out_date) IS NOT NULL AND (
      move_in_date IS NULL OR
      move_out_date >= move_in_date
    ))
  ),
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  apartment_id INTEGER NOT NULL,
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

-- Automatically set is_active=0 when a move_out_date is recorded
CREATE TRIGGER IF NOT EXISTS trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

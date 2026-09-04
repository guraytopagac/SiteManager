-- An apartment has at most one active resident. Older ones stay as history rows.
CREATE TABLE IF NOT EXISTS residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  -- Optional text fields must be NULL or non-blank.
  full_name TEXT CHECK(full_name IS NULL OR (length(trim(full_name)) > 0 AND length(full_name) <= 60)),
  phone TEXT CHECK(phone IS NULL OR (
    length(phone) BETWEEN 10 AND 20 AND
    length(trim(phone)) > 0 AND
    phone NOT GLOB '*[^0-9+()- ]*'
  )),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id NOT GLOB '*[^0-9]*')),
  resident_type TEXT CHECK(resident_type IS NULL OR resident_type IN ('owner', 'tenant')),
  -- How many people live in the apartment. Required, unlike the fields above, because the
  -- building list sums it. One resident row still stands for one apartment.
  household_size INTEGER NOT NULL DEFAULT 1 CHECK(typeof(household_size) = 'integer' AND household_size BETWEEN 1 AND 20),
  move_in_date TEXT CHECK(move_in_date IS NULL OR (
    date(move_in_date) IS NOT NULL AND
    move_in_date >= '2000-01-01' AND
    move_in_date <= '2100-12-31'
  )),
  -- Only moveOutResident writes this. It cannot be earlier than the move-in date.
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

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

-- A move-out date of today or earlier deactivates the resident. A later one keeps them active.
CREATE TRIGGER IF NOT EXISTS trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

-- Same rule on insert.
CREATE TRIGGER IF NOT EXISTS trg_residents_move_out_insert
  AFTER INSERT ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

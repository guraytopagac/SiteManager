-- An apartment holds at most one active owner row and one active tenant row. The owner is the
-- lasting record and the tenant comes and goes, so the two are told apart by resident_type rather
-- than by their order. Older rows of either kind stay as history.
CREATE TABLE IF NOT EXISTS residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  -- Optional text fields must be NULL or non-blank.
  full_name TEXT CHECK(full_name IS NULL OR (length(trim(full_name)) > 0 AND length(full_name) <= 60)),
  -- Ten digits, no leading zero and no separators. The grouping the user sees (545 545 55 55)
  -- is produced at display time, see src/utils/phoneNumber.js.
  phone TEXT CHECK(phone IS NULL OR (
    length(phone) = 10 AND
    phone NOT GLOB '*[^0-9]*' AND
    substr(phone, 1, 1) <> '0'
  )),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id NOT GLOB '*[^0-9]*')),
  -- Required, because the two active rows of an apartment are identified by this column.
  resident_type TEXT NOT NULL CHECK(resident_type IN ('owner', 'tenant')),
  -- Whether this person lives in the apartment. A tenant always does, which the table CHECK below
  -- enforces. For an owner it answers "does the owner live here when the flat is not rented", so an
  -- owner recorded only as a contact for an empty or rented flat never counts as living there.
  is_occupant INTEGER NOT NULL DEFAULT 1 CHECK(is_occupant IN (0, 1)),
  -- How many people live in the apartment. Optional, because the user may not know it: NULL means
  -- unknown and the building list's sum skips such a row, so the flat still counts as occupied but
  -- adds nothing to the headcount. Only the occupant row is summed, so a non-occupying owner never
  -- adds to it either.
  household_size INTEGER CHECK(
    household_size IS NULL OR
    (typeof(household_size) = 'integer' AND household_size BETWEEN 1 AND 20)
  ),
  -- The day the record takes effect. NULL for every ordinary row, which counts from its own
  -- created_at instead. It is written only when a move-out is dated ahead and the record that
  -- follows it is entered at the same time: that row waits with is_active = 0 until the day comes.
  move_in_date TEXT CHECK(
    move_in_date IS NULL OR
    (date(move_in_date) IS NOT NULL AND
     move_in_date >= '2000-01-01' AND
     move_in_date <= '2100-12-31')
  ),
  -- Only moveOutResident writes this.
  move_out_date TEXT CHECK(
    move_out_date IS NULL OR
    (date(move_out_date) IS NOT NULL AND
     move_out_date >= '2000-01-01' AND
     move_out_date <= '2100-12-31')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  CHECK(resident_type = 'owner' OR is_occupant = 1),
  CHECK(move_in_date IS NULL OR move_out_date IS NULL OR move_in_date <= move_out_date)
);

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

-- One active row of each kind per apartment. Partial, so the history rows are free to repeat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_active_type
  ON residents(apartment_id, resident_type) WHERE is_active = 1;

-- One queued row of each kind per apartment: not active yet, and not closed either.
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_pending_type
  ON residents(apartment_id, resident_type) WHERE is_active = 0 AND move_out_date IS NULL;

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

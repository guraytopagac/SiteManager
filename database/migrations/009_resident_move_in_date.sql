-- A transfer can now be dated ahead together with the record that follows it. The old row stays
-- open until that day and the new one waits beside it, so "who lives here" needs a start date that
-- is not the row's own created_at: a row written today would otherwise count from today and would
-- overlap the record it replaces.
--
-- move_in_date is that start. It is NULL for every ordinary record, which keeps the old rule in
-- place: a row counts from the day it was recorded. It is written only by a dated-ahead move-out
-- that carries a successor, and such a row waits with is_active = 0 until the day arrives.
--
-- ADD COLUMN cannot carry the table CHECK that ties the two dates together, so the table is rebuilt.
-- The partial unique index on the queued rows is the last line of defence for "one successor at a
-- time"; the service says it first with a sentence the user can read.

CREATE TABLE residents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  full_name TEXT CHECK(full_name IS NULL OR (length(trim(full_name)) > 0 AND length(full_name) <= 60)),
  phone TEXT CHECK(phone IS NULL OR (
    length(phone) = 10 AND
    phone NOT GLOB '*[^0-9]*' AND
    substr(phone, 1, 1) <> '0'
  )),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  national_id TEXT CHECK(national_id IS NULL OR (length(national_id) = 11 AND national_id NOT GLOB '*[^0-9]*')),
  resident_type TEXT NOT NULL CHECK(resident_type IN ('owner', 'tenant')),
  is_occupant INTEGER NOT NULL DEFAULT 1 CHECK(is_occupant IN (0, 1)),
  household_size INTEGER NOT NULL DEFAULT 1 CHECK(typeof(household_size) = 'integer' AND household_size BETWEEN 1 AND 20),
  move_in_date TEXT CHECK(
    move_in_date IS NULL OR
    (date(move_in_date) IS NOT NULL AND
     move_in_date >= '2000-01-01' AND
     move_in_date <= '2100-12-31')
  ),
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

INSERT INTO residents_new (
  id, apartment_id, full_name, phone, email, national_id, resident_type, is_occupant,
  household_size, move_in_date, move_out_date, is_active, created_at, updated_at
)
SELECT
  id, apartment_id, full_name, phone, email, national_id, resident_type, is_occupant,
  household_size, NULL, move_out_date, is_active, created_at, updated_at
FROM residents;

-- A closed row without a date cannot come from this app, but it would read as a queued row under
-- the new index. Dating it at its own creation keeps it where it belongs, in the history.
UPDATE residents_new SET move_out_date = date(created_at)
WHERE is_active = 0 AND move_out_date IS NULL;

DROP TABLE residents;

ALTER TABLE residents_new RENAME TO residents;

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_active_type
  ON residents(apartment_id, resident_type) WHERE is_active = 1;

-- One queued row of each kind per apartment: not active yet, and not closed either.
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_pending_type
  ON residents(apartment_id, resident_type) WHERE is_active = 0 AND move_out_date IS NULL;

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

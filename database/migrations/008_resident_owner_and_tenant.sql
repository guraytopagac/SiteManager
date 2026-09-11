-- An apartment can now hold an owner row and a tenant row at the same time. The owner is the
-- lasting contact, the tenant comes and goes, and the manager needs both: the flat is often rented
-- out while the dues, the major repairs and the ownership questions still belong to the owner.
--
-- Two changes, and the first one needs the table rebuilt, so they share one migration.
--
-- 1. resident_type becomes NOT NULL. It used to be a decorative label that could be left empty.
--    It now decides which of the two active rows a row is, so it can no longer be missing. Rows
--    that carry no type become 'tenant', because an existing row always stood for whoever lived
--    in the apartment.
-- 2. is_occupant is added. A tenant always lives in the apartment, an owner may or may not, and
--    without this column an owner recorded for an empty flat would make it count as occupied and
--    would add a person to the building's headcount.
--
-- The partial unique index is the last line of defence for the first rule and the table CHECK for
-- the second. A database written before them could in theory hold two active rows for one
-- apartment, since the old rule only lived in the service, so the extra rows are closed here
-- rather than letting index creation fail and stop the app from opening.

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
  -- Whether this person lives in the apartment. A tenant always does, which the table CHECK below
  -- enforces. For an owner it answers "does the owner live here when the flat is not rented", so an
  -- owner recorded only as a contact for an empty or rented flat never counts as living there.
  is_occupant INTEGER NOT NULL DEFAULT 1 CHECK(is_occupant IN (0, 1)),
  household_size INTEGER NOT NULL DEFAULT 1 CHECK(typeof(household_size) = 'integer' AND household_size BETWEEN 1 AND 20),
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
  CHECK(resident_type = 'owner' OR is_occupant = 1)
);

INSERT INTO residents_new (
  id, apartment_id, full_name, phone, email, national_id, resident_type, is_occupant,
  household_size, move_out_date, is_active, created_at, updated_at
)
SELECT
  id, apartment_id, full_name, phone, email, national_id,
  COALESCE(resident_type, 'tenant'), 1,
  household_size, move_out_date, is_active, created_at, updated_at
FROM residents;

-- Keeps the newest active row of each apartment and closes the rest.
UPDATE residents_new SET is_active = 0
WHERE is_active = 1
  AND id NOT IN (SELECT MAX(id) FROM residents_new WHERE is_active = 1 GROUP BY apartment_id);

DROP TABLE residents;

ALTER TABLE residents_new RENAME TO residents;

CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_active_type
  ON residents(apartment_id, resident_type) WHERE is_active = 1;

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

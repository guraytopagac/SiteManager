-- Three changes that all need the table rebuilt, so they share one migration.
--
-- 1. phone becomes a plain 10 digit national number with no leading zero. The old CHECK meant to
--    allow spaces, dashes and parentheses but never did: inside the GLOB class '[^0-9+()- ]' the
--    dash sits between ')' and ' ' and is read as a range, so those three characters were rejected
--    while the handler regex accepted them. Digits only removes the class problem entirely and the
--    grouping (545 545 55 55) is now produced for display instead of being stored.
-- 2. notes is dropped. Nothing reads or writes it any more.
-- 3. move_in_date is dropped. It only ever answered "from which month does this row count", which
--    created_at already answers, and the date itself is unknowable for a resident who moved in
--    years before the ledger existed. move_out_date loses the comparison against it.
--
-- Existing numbers are normalized rather than discarded: separators are stripped, then a +90 or a
-- leading 0 prefix. Whatever still fails the new shape becomes NULL, because a migration that
-- raises would stop the app from opening at all.

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
  resident_type TEXT CHECK(resident_type IS NULL OR resident_type IN ('owner', 'tenant')),
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
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
);

WITH stripped AS (
  SELECT
    id, apartment_id, full_name, email, national_id, resident_type, household_size,
    move_out_date, is_active, created_at, updated_at,
    replace(replace(replace(replace(replace(COALESCE(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') AS digits
  FROM residents
),
localized AS (
  SELECT
    id, apartment_id, full_name, email, national_id, resident_type, household_size,
    move_out_date, is_active, created_at, updated_at,
    CASE
      WHEN length(digits) = 13 AND substr(digits, 1, 3) = '090' THEN substr(digits, 4)
      WHEN length(digits) = 12 AND substr(digits, 1, 2) = '90' THEN substr(digits, 3)
      WHEN length(digits) = 11 AND substr(digits, 1, 1) = '0' THEN substr(digits, 2)
      ELSE digits
    END AS local_digits
  FROM stripped
)
INSERT INTO residents_new (
  id, apartment_id, full_name, phone, email, national_id, resident_type, household_size,
  move_out_date, is_active, created_at, updated_at
)
SELECT
  id, apartment_id, full_name,
  CASE
    WHEN length(local_digits) = 10 AND local_digits NOT GLOB '*[^0-9]*' AND substr(local_digits, 1, 1) <> '0'
      THEN local_digits
    ELSE NULL
  END,
  email, national_id, resident_type, household_size,
  move_out_date, is_active, created_at, updated_at
FROM localized;

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

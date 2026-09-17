-- The apartment number is now unique among active apartments only, so addApartment inserts a new row
-- instead of reviving a deleted one together with its dues, payments and residents.
DROP INDEX IF EXISTS idx_apartments_building_no;

CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_building_no
  ON apartments(building_id, apartment_no COLLATE NOCASE)
  WHERE is_active = 1;

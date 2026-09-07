-- The apartment number is now unique among active apartments only. A deleted apartment keeps its
-- number in the table without blocking a new one, so addApartment can insert a genuinely new row
-- instead of reviving the old one together with its dues, payments and residents.
DROP INDEX IF EXISTS idx_apartments_building_no;

CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_building_no
  ON apartments(building_id, apartment_no COLLATE NOCASE)
  WHERE is_active = 1;

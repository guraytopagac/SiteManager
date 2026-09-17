-- Adds the household size, the number the building list sums. Existing rows fall back to 1, so the column
-- can be NOT NULL without stopping the app from opening.

ALTER TABLE residents ADD COLUMN household_size INTEGER NOT NULL DEFAULT 1
  CHECK(typeof(household_size) = 'integer' AND household_size BETWEEN 1 AND 20);

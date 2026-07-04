-- Apartments table: one row per physical unit in the building.
-- apartment_no is case-insensitive unique per manager (e.g. "1A" == "1a");
-- two different managers may each have their own "1A".
-- floor allows negative values for basement floors (-2 to 99).
-- due_amount is the monthly dues amount for this specific apartment.
-- Resident info is stored separately in the residents table.
CREATE TABLE IF NOT EXISTS apartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL,
  apartment_no TEXT NOT NULL CHECK(
    length(apartment_no) BETWEEN 1 AND 10 AND
    apartment_no NOT GLOB '*[^A-Za-z0-9]*'
  ),
  floor INTEGER CHECK(floor IS NULL OR (floor >= -2 AND floor <= 99)),
  type TEXT NOT NULL CHECK(type IN ('0+1', '1+1', '2+1', '3+1', '4+1')),
  square_meters REAL CHECK(square_meters IS NULL OR (square_meters > 0 AND square_meters <= 1000)),
  -- 50000: practical upper bound for monthly dues (₺); raise if needed
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_apartments_manager_id ON apartments(manager_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_no_manager ON apartments(manager_id, apartment_no COLLATE NOCASE);


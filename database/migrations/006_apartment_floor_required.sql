-- Makes the floor mandatory. Every write path already sent one, so the nullable column only kept
-- an unreachable branch alive in the UI. SQLite cannot ALTER a CHECK, so the table is rebuilt.

CREATE TABLE apartments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  apartment_no TEXT NOT NULL CHECK(
    length(apartment_no) BETWEEN 1 AND 10 AND
    apartment_no NOT GLOB '*[^A-Za-z0-9]*'
  ),
  floor INTEGER NOT NULL CHECK(floor >= -2 AND floor <= 99),
  type TEXT NOT NULL CHECK(type IN ('0+1', '1+1', '2+1', '3+1', '4+1')),
  square_meters REAL CHECK(square_meters IS NULL OR (square_meters > 0 AND square_meters <= 1000)),
  -- Current monthly due. Accrual copies it into each dues row, so edits do not change past months.
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

-- A row without a floor becomes a ground floor row, so this cannot stop the app from opening.
INSERT INTO apartments_new (
  id, building_id, apartment_no, floor, type, square_meters, due_amount, is_active, created_at, updated_at
)
SELECT
  id, building_id, apartment_no, COALESCE(floor, 0), type, square_meters, due_amount, is_active, created_at, updated_at
FROM apartments;

-- DROP TABLE also drops the partial unique index, so it is created again below.
DROP TABLE apartments;

ALTER TABLE apartments_new RENAME TO apartments;

CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_building_no
  ON apartments(building_id, apartment_no COLLATE NOCASE)
  WHERE is_active = 1;

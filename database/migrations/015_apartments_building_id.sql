CREATE TABLE apartments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  apartment_no TEXT NOT NULL CHECK(
    length(apartment_no) BETWEEN 1 AND 10 AND
    apartment_no NOT GLOB '*[^A-Za-z0-9]*'
  ),
  floor INTEGER CHECK(floor IS NULL OR (floor >= -2 AND floor <= 99)),
  type TEXT NOT NULL CHECK(type IN ('0+1', '1+1', '2+1', '3+1', '4+1')),
  square_meters REAL CHECK(square_meters IS NULL OR (square_meters > 0 AND square_meters <= 1000)),
  due_amount REAL NOT NULL CHECK(due_amount > 0 AND due_amount <= 50000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

INSERT INTO apartments_new (id, building_id, apartment_no, floor, type, square_meters, due_amount, is_active, created_at, updated_at)
SELECT a.id, b.id, a.apartment_no, a.floor, a.type, a.square_meters, a.due_amount, a.is_active, a.created_at, a.updated_at
FROM apartments a
JOIN buildings b ON b.owner_id = a.manager_id;

DROP TABLE apartments;
ALTER TABLE apartments_new RENAME TO apartments;

CREATE INDEX IF NOT EXISTS idx_apartments_building_id ON apartments(building_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_no_building ON apartments(building_id, apartment_no COLLATE NOCASE);

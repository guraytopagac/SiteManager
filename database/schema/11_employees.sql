-- Staff of a building (doorkeeper, gardener, guard), kept for the severance estimate. Not a financial
-- record, so a row without payouts may be deleted.
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  full_name TEXT NOT NULL CHECK(length(trim(full_name)) >= 2 AND length(full_name) <= 60),
  role TEXT CHECK(role IS NULL OR (length(trim(role)) > 0 AND length(role) <= 40)),
  start_date TEXT NOT NULL CHECK(
    date(start_date) IS NOT NULL AND
    start_date >= '2000-01-01' AND
    start_date <= '2100-12-31'
  ),
  gross_wage REAL NOT NULL CHECK(gross_wage > 0 AND gross_wage <= 1000000),
  -- NULL while the employee still works there.
  end_date TEXT CHECK(end_date IS NULL OR (
    date(end_date) IS NOT NULL AND
    end_date >= '2000-01-01' AND
    end_date <= '2100-12-31'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  CHECK(end_date IS NULL OR end_date >= start_date),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_employees_building_id ON employees(building_id);

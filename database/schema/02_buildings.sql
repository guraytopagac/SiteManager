-- One building is one ledger. Building data is kept apart by building_id.
CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 60),
  -- Two soft-delete steps. is_active = 0 is archived, is_removed = 1 is removed for good.
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK(is_removed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Partial index, so the name of a removed building can be used again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_owner_name
  ON buildings(owner_id, name COLLATE NOCASE) WHERE is_removed = 0;

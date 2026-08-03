ALTER TABLE buildings ADD COLUMN is_purged INTEGER NOT NULL DEFAULT 0 CHECK(is_purged IN (0, 1));

DROP INDEX IF EXISTS idx_buildings_name_owner;

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_name_owner
  ON buildings(owner_id, name COLLATE NOCASE) WHERE is_purged = 0;

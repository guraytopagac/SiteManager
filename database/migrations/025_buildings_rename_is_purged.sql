ALTER TABLE buildings RENAME COLUMN is_purged TO is_removed;

DROP INDEX IF EXISTS idx_buildings_name_owner;

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_name_owner
  ON buildings(owner_id, name COLLATE NOCASE) WHERE is_removed = 0;

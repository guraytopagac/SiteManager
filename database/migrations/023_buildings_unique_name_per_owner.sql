UPDATE buildings
SET name = substr(name || ' (' || id || ')', 1, 60)
WHERE EXISTS (
  SELECT 1 FROM buildings other
  WHERE other.owner_id = buildings.owner_id
    AND other.id < buildings.id
    AND other.name = buildings.name COLLATE NOCASE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_name_owner ON buildings(owner_id, name COLLATE NOCASE);

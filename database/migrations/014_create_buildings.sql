CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 60),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_buildings_owner_id ON buildings(owner_id);

CREATE TRIGGER IF NOT EXISTS trg_buildings_updated_at
  AFTER UPDATE ON buildings FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE buildings SET updated_at = datetime('now', '+3 hours') WHERE id = NEW.id;
END;

INSERT INTO buildings (owner_id, name, is_active, created_at, updated_at)
SELECT u.id,
       COALESCE(NULLIF(TRIM(u.display_name), ''), 'Bina'),
       u.is_active,
       datetime('now', '+3 hours'),
       datetime('now', '+3 hours')
FROM users u
WHERE u.role = 'manager'
  AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.owner_id = u.id);

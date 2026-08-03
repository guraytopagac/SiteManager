CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK(
    length(username) BETWEEN 3 AND 30 AND
    username NOT GLOB '*[^A-Za-z0-9_]*'
  ),
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  manager_name TEXT NOT NULL CHECK(length(manager_name) BETWEEN 2 AND 60),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login TEXT CHECK(last_login IS NULL OR datetime(last_login) IS NOT NULL),
  password_changed_at TEXT CHECK(
    password_changed_at IS NULL OR
    datetime(password_changed_at) IS NOT NULL
  ),
  created_at TEXT DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
);

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
  AFTER UPDATE ON users FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now', '+3 hours') WHERE id = NEW.id;
END;


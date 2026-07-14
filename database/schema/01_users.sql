CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK(
    length(username) >= 3 AND
    username GLOB '[A-Za-z0-9_]*'
  ),
  email TEXT UNIQUE NOT NULL CHECK(email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT,
  role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
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


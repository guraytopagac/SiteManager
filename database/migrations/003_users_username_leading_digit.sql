-- Relax username CHECK constraint to allow a leading digit (was letter/underscore only).
-- SQLite cannot ALTER a CHECK constraint, so the table is rebuilt and data copied over.
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK(
    length(username) >= 3 AND
    username GLOB '[A-Za-z0-9_]*'
  ),
  email TEXT UNIQUE NOT NULL CHECK(email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT,
  role TEXT DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login TEXT CHECK(last_login IS NULL OR datetime(last_login) IS NOT NULL),
  password_changed_at TEXT CHECK(
    password_changed_at IS NULL OR
    datetime(password_changed_at) IS NOT NULL
  ),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO users_new SELECT * FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
  AFTER UPDATE ON users FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

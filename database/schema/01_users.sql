-- The one account of this machine. There are no roles, and one row means setup is done.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE CHECK(
    length(username) BETWEEN 3 AND 30 AND
    username NOT GLOB '*[^A-Za-z0-9_]*'
  ),
  -- Optional and for information only. It is not an identifier and not a recovery channel.
  email TEXT CHECK(email IS NULL OR (email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254)),
  -- Name of the person who currently holds the account.
  manager_name TEXT NOT NULL CHECK(length(manager_name) BETWEEN 2 AND 60),
  password_hash TEXT NOT NULL,
  -- bcrypt hash of the recovery code. The code is single use, a new one is issued after each use.
  recovery_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login TEXT CHECK(last_login IS NULL OR datetime(last_login) IS NOT NULL),
  -- Written on INSERT, so it does not tell you whether setup is done. The row itself does.
  password_changed_at TEXT NOT NULL CHECK(datetime(password_changed_at) IS NOT NULL),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- A separate index, not a column UNIQUE, so the NOCASE collation stays visible.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);

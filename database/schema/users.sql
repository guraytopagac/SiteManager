CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_login TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

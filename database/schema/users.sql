CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'manager',
  is_active INTEGER DEFAULT 1,
  last_login TEXT
);

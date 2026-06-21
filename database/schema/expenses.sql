CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL CHECK(amount > 0),
  date TEXT NOT NULL,
  description TEXT,
  manager_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
);

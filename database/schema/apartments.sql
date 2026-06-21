CREATE TABLE IF NOT EXISTS apartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_no TEXT NOT NULL UNIQUE,
  floor INTEGER,
  type TEXT,
  square_meters REAL,
  due_amount REAL CHECK(due_amount >= 0),
  resident_name TEXT,
  resident_phone TEXT,
  resident_email TEXT,
  manager_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
);

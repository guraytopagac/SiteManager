CREATE TABLE IF NOT EXISTS dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  due_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE(apartment_id, year, month)
);

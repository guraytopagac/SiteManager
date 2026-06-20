CREATE TABLE IF NOT EXISTS apartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_no TEXT NOT NULL UNIQUE,
  floor INTEGER,
  type TEXT,
  square_meters REAL,
  due_amount REAL,
  resident_name TEXT,
  resident_phone TEXT,
  resident_email TEXT,
  manager_id INTEGER,
  FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS due_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  due_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  payment_date TEXT NOT NULL,
  receipt_path TEXT,
  note TEXT,
  collected_by INTEGER NOT NULL,
  is_cancelled INTEGER DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
  cancelled_at TEXT,
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(due_id) REFERENCES dues(id) ON DELETE CASCADE,
  FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE RESTRICT
);

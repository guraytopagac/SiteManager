const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
const { app } = require("electron");

const isPackaged = app ? app.isPackaged : false;
const dbPath = isPackaged
  ? path.join(app.getPath("userData"), "database.db")
  : path.join(__dirname, "..", "database.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'manager',
    is_active INTEGER DEFAULT 1,
    last_login TEXT
  );

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

  CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    manager_id INTEGER,
    FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    manager_id INTEGER,
    FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
  );

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

  CREATE TABLE IF NOT EXISTS due_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    due_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    receipt_path TEXT,
    note TEXT,
    collected_by INTEGER NOT NULL,
    is_cancelled INTEGER DEFAULT 0,
    cancelled_at TEXT,
    cancel_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(due_id) REFERENCES dues(id) ON DELETE CASCADE,
    FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE RESTRICT
  );
`);

// Seed admin account if none exists
const { count } = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).get();
if (count === 0) {
  const hashedPassword = bcrypt.hashSync("admin123", 12);
  db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
    "admin",
    "admin@mavikent.com",
    hashedPassword,
    "admin",
  );
  console.log("\nAdmin account created.");
}

console.log("Successfully connected to the database.");

module.exports = db;

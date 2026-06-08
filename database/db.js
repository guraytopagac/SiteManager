// Libraries
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const { app } = require("electron");

// Variables
let dbPath;
const isPackaged = app ? app.isPackaged : false;

// Database Path
if (!isPackaged) {
  dbPath = path.join(__dirname, "..", "database.db");
} else {
  dbPath = path.join(app.getPath("userData"), "database.db");
}

// Constructing Tables
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
    return;
  } else {
    console.log("Successfully connected to the database.");
  }

  // Enable foreign key constraints
  db.run("PRAGMA foreign_keys = ON;");

  // Create tables if they don't exist
  db.serialize(() => {
    // Users Table
    db.run(
      `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT,
                role TEXT DEFAULT 'manager',
                is_active INTEGER DEFAULT 1,
                last_login TEXT
            );
        `,
      (tableErr1) => {
        if (tableErr1) console.error("Users table creation error:", tableErr1.message);
      },
    );

    // Apartments Table
    db.run(
      `
            CREATE TABLE IF NOT EXISTS apartments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                apartment_no TEXT NOT NULL UNIQUE,
                floor INTEGER,
                type TEXT,
                square_meters REAL,
                due_amount REAL,
                manager_id INTEGER,
                FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `,
      (tableErr2) => {
        if (tableErr2) console.error("Apartments table creation error:", tableErr2.message);
      },
    );

    // Incomes Table
    db.run(
      `
            CREATE TABLE IF NOT EXISTS incomes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                description TEXT,
                manager_id INTEGER,
                FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `,
      (tableErr3) => {
        if (tableErr3) console.error("Incomes table creation error:", tableErr3.message);
      },
    );

    // Expenses Table
    db.run(
      `
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                description TEXT,
                manager_id INTEGER,
                FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `,
      (tableErr4) => {
        if (tableErr4) console.error("Expenses table creation error:", tableErr4.message);
      },
    );

    // Dues Table
    db.run(
      `
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
        `,
      (tableErr5) => {
        if (tableErr5) console.error("Dues table creation error:", tableErr5.message);
      },
    );

    // Due Payments Table
    db.run(
      `
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
        `,
      (tableErr6) => {
        if (tableErr6) console.error("Due payments table creation error:", tableErr6.message);
      },
    );

    // Seed admin account if no admins exist
    db.get(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`, (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const hashedPassword = bcrypt.hashSync("admin123", 12);
        db.run(
          `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`,
          ["admin", "admin@mavikent.com", hashedPassword, "admin"],
          (seedErr) => {
            if (seedErr) {
              console.error("Admin account creation error:", seedErr.message);
            } else {
              console.log("\nAdmin account created.");
            }
          },
        );
      }
    });
  });
});

module.exports = db;

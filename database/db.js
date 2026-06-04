// Libraries
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

// Variables
let dbPath;
const isPackaged = app ? app.isPackaged : false;

// Database Path
if (!isPackaged) {
    dbPath = path.join(__dirname, '..', 'database.db');
} else {
    dbPath = path.join(app.getPath('userData'), 'database.db');
}

// Constructing Tables
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veri tabanı bağlantı hatası:', err.message);
        return;
    } else {
        console.log('Successfully connected to the database.');
    }

    db.run("PRAGMA foreign_keys = ON;");

    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT,
                role TEXT DEFAULT 'manager',
                is_active INTEGER DEFAULT 1,
                last_login TEXT
            );
        `, (tableErr1) => {
            if (tableErr1) console.error('Users tablosu oluşturma hatası:', tableErr1.message);
        });

        db.run(`
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
        `, (tableErr2) => {
            if (tableErr2) console.error('Apartments tablosu oluşturma hatası:', tableErr2.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS incomes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                description TEXT,
                manager_id INTEGER,
                FOREIGN KEY(manager_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `, (tableErr3) => {
            if (tableErr3) console.error('Incomes tablosu oluşturma hatası:', tableErr3.message);
        });
    });
});

module.exports = db;
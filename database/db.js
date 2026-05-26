// Libraries
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

let dbPath;
const isPackaged = app ? app.isPackaged : false;

// Part 1: Determine the database path based on the environment (development or production)
if (!isPackaged) {
    dbPath = path.join(__dirname, '..', 'apartment.db');
} else {
    dbPath = path.join(app.getPath('userData'), 'apartment.db');
}

// Part 2: Connect to the SQLite database and create the users table if it doesn't exist
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veri tabanı bağlantı hatası:', err.message);
        return;
    }

    console.log('Successfully connected to the database.');

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
            )
        `, (tableErr) => {
            if (tableErr) console.error('Tablo oluşturma hatası:', tableErr.message);
        });
    });
});

// Part 3: Export the database connection for use in other parts of the application
module.exports = db;
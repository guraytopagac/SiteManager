const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

const isPackaged = app?.isPackaged ?? false;
const dbPath = isPackaged
  ? path.join(app?.getPath("userData") ?? __dirname, "database.db")
  : path.join(__dirname, "..", "database.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 3000");

// Tablolar foreign key bağımlılık sırasına göre yüklenir
const schemaFiles = [
  "users.sql",
  "apartments.sql",
  "incomes.sql",
  "expenses.sql",
  "dues.sql",
  "due_payments.sql",
];

const schemaDir = path.join(__dirname, "schema");
for (const file of schemaFiles) {
  try {
    const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");
    db.exec(sql);
  } catch (e) {
    throw new Error(`Schema yüklenemedi: ${file} — ${e.message}`);
  }
}

if (!isPackaged) console.log("DB bağlantısı kuruldu.");

module.exports = db;

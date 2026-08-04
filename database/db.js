const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

const dbPath = app.isPackaged
  ? path.join(app.getPath("userData"), "database.db")
  : path.join(__dirname, "..", "database.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

console.warn(`[Database] Opening database: ${dbPath}`);

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 3000");
db.pragma("cache_size = -16000");
db.pragma("temp_store = MEMORY");

function runQuietly(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`[Database] ${name} failed:`, e.message);
  }
}

function closeDb() {
  if (!db.open) return;
  runQuietly("optimize", () => db.pragma("optimize"));
  runQuietly("checkpoint", () => db.pragma("wal_checkpoint(TRUNCATE)"));
  runQuietly("close", () => db.close());
}

app.on("will-quit", closeDb);

module.exports = { db, closeDb };

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

const isPackaged = app.isPackaged;

const dbPath = isPackaged
  ? path.join(app.getPath("userData"), "database.db")
  : path.join(__dirname, "..", "database.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;
try {
  db = new Database(dbPath);
} catch (e) {
  throw new Error(`[Database] Failed to open database (${dbPath}): ${e.message}`, { cause: e });
}

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 3000");
db.pragma("cache_size = -16000");
db.pragma("temp_store = MEMORY");

function closeDb() {
  if (!db.open) return;
  try {
    db.pragma("optimize");
  } catch (e) {
    if (!isPackaged) console.error("[Database] optimize failed:", e.message);
  }
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (e) {
    if (!isPackaged) console.error("[Database] checkpoint failed:", e.message);
  }
  try {
    db.close();
  } catch (e) {
    if (!isPackaged) console.error("[Database] close failed:", e.message);
  }
}

app.on("before-quit", closeDb);

if (!isPackaged) console.warn(`[Database] Database connection established: ${dbPath}`);

module.exports = { db, closeDb };

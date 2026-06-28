const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

const isPackaged = app.isPackaged;

// Packaged: writes to %APPDATA%/Mavikent Site Yönetimi/; dev: uses repo root
const dbPath = isPackaged
  ? path.join(app.getPath("userData"), "database.db")
  : path.join(__dirname, "..", "database.db");

// userData directory may not exist on first install
if (isPackaged) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
} catch (e) {
  throw new Error(`[Database] Failed to open database (${dbPath}): ${e.message}`);
}

db.pragma("foreign_keys = ON");
// WAL: readers do not block writers and vice versa
db.pragma("journal_mode = WAL");
// NORMAL: sufficient durability in WAL mode without full fsync overhead
db.pragma("synchronous = NORMAL");
// Wait up to 3s instead of immediately erroring when another process holds the DB
db.pragma("busy_timeout = 3000");
// Negative value = KB; 2 MB page cache
db.pragma("cache_size = -2000");
db.pragma("temp_store = MEMORY");

function closeDb() {
  if (!db.open) return;
  try {
    // Flush WAL and update query planner statistics
    db.pragma("optimize");
  } catch (e) {
    if (!isPackaged) console.error("[Database] optimize failed:", e.message);
  }
  try {
    db.close();
  } catch (e) {
    if (!isPackaged) console.error("[Database] close failed:", e.message);
  }
}

app.on("before-quit", closeDb);

if (!isPackaged) console.log(`[Database] Database connection established: ${dbPath}`);

module.exports = { db, closeDb };

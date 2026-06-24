const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

const DB_BUSY_TIMEOUT_MS = 3000;

const isPackaged = app?.isPackaged ?? false;
const dbPath = isPackaged
  ? path.join(app?.getPath("userData") ?? __dirname, "database.db")
  : path.join(__dirname, "..", "database.db");

if (isPackaged) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
} catch (e) {
  throw new Error(`Failed to open database (${dbPath}): ${e.message}`);
}

db.pragma("foreign_keys = ON"); // enforce foreign key constraints
db.pragma("journal_mode = WAL"); // concurrent reads while writing
db.pragma("synchronous = NORMAL"); // safe and fast in WAL mode
db.pragma(`busy_timeout = ${DB_BUSY_TIMEOUT_MS}`); // wait up to 3s on lock
db.pragma("cache_size = -8000"); // 8 MB page cache — sufficient for this app's DB size
db.pragma("temp_store = MEMORY"); // keep temp tables in RAM
db.pragma("auto_vacuum = INCREMENTAL"); // reclaim free pages on new DBs (no-op on existing)
db.pragma("analysis_limit = 400"); // cap rows scanned per table during optimize

const integrityResult = db.pragma("quick_check", { simple: true });
if (integrityResult !== "ok") {
  throw new Error(`Database integrity check failed (${dbPath}): ${integrityResult}`);
}

function closeDb() {
  if (!db.open) return;
  try {
    db.pragma("optimize");
  } catch {}
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {}
  try {
    db.close();
  } catch {}
}

app?.on("before-quit", closeDb);
process.on("exit", closeDb);

if (!isPackaged) console.log(`Database connection established: ${dbPath}`);

module.exports = db;
module.exports.closeDb = closeDb;

// The one SQLite connection of the main process. Requiring this file does NOT open it.
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

let db = null;

function resolveDbPath() {
  return app.isPackaged ? path.join(app.getPath("userData"), "database.db") : path.join(__dirname, "..", "database.db");
}

// Runs one shutdown step. A failure here must not skip the next one.
function runQuietly(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`[Database] ${name} failed:`, e);
  }
}

// Sets db to null at the end, so getDb() can never hand out a closed connection.
function closeDb() {
  if (!db) return;

  if (db.open) {
    runQuietly("optimize", () => db.pragma("optimize"));
    runQuietly("checkpoint", () => db.pragma("wal_checkpoint(TRUNCATE)"));
    runQuietly("close", () => db.close());
  }

  db = null;
}

// Safe to call twice. Only main.js calls it, at startup.
function openDatabase() {
  if (db) return db;

  const dbPath = resolveDbPath();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  console.warn(`[Database] Opening database: ${dbPath}`);

  db = new Database(dbPath);

  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 3000");
  db.pragma("cache_size = -16000");
  db.pragma("temp_store = MEMORY");

  // will-quit, not before-quit. Renderers can still send IPC while windows are closing.
  app.on("will-quit", closeDb);

  return db;
}

// Call this on every query. Never store the result in a module body.
function getDb() {
  if (!db) throw new Error("[Database] getDb called before openDatabase");
  return db;
}

module.exports = { openDatabase, getDb, closeDb };

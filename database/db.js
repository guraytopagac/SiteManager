const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

let db = null;

function resolveDbPath() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "database.db")
    : path.join(__dirname, "..", "database.db");
}

function runQuietly(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`[Database] ${name} failed:`, e);
  }
}

function closeDb() {
  if (!db) return;

  if (db.open) {
    runQuietly("optimize", () => db.pragma("optimize"));
    runQuietly("checkpoint", () => db.pragma("wal_checkpoint(TRUNCATE)"));
    runQuietly("close", () => db.close());
  }

  db = null;
}

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

  app.on("will-quit", closeDb);

  return db;
}

function getDb() {
  if (!db) throw new Error("[Database] getDb called before openDatabase");
  return db;
}

module.exports = { openDatabase, getDb, closeDb };

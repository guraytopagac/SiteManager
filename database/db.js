const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

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
  throw new Error(`Veritabanı açılamadı (${dbPath}): ${e.message}`);
}

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 3000");
db.pragma("wal_autocheckpoint = 0");
db.pragma("cache_size = -32000");

const integrityResult = db.pragma("quick_check", { simple: true });
if (integrityResult !== "ok") {
  throw new Error(`Veritabanı bütünlük hatası (${dbPath}): ${integrityResult}`);
}

app?.on("before-quit", () => {
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
});

if (!isPackaged) console.log("DB bağlantısı kuruldu.");

module.exports = db;

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare(`SELECT filename FROM migrations`)
      .all()
      .map((r) => r.filename),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.exec(sql);
    db.prepare(`INSERT INTO migrations (filename) VALUES (?)`).run(file);
    console.log(`Migration was implemented: ${file}`);
  }
}

module.exports = { runMigrations };

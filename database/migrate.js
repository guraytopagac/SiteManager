const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const SCHEMA_DIR = path.join(__dirname, "schema");

// Tablolar foreign key bağımlılık sırasına göre yüklenir
const SCHEMA_FILES = [
  "users.sql",
  "apartments.sql",
  "incomes.sql",
  "expenses.sql",
  "dues.sql",
  "due_payments.sql",
];

function loadSchema(db) {
  for (const file of SCHEMA_FILES) {
    try {
      const sql = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8");
      db.exec(sql);
    } catch (e) {
      throw new Error(`Schema yüklenemedi: ${file} — ${e.message}`);
    }
  }
}

function runMigrations(db) {
  loadSchema(db);

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

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applyMigration = db.transaction((file, sql) => {
    db.exec(sql);
    db.prepare(`INSERT INTO migrations (filename) VALUES (?)`).run(file);
  });

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    if (!sql.trim()) {
      console.warn(`Migration skipped (empty file): ${file}`);
      continue;
    }

    applyMigration(file, sql);
    console.log(`Migration was implemented: ${file}`);
  }
}

module.exports = { runMigrations };

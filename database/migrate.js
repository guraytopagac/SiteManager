const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const SCHEMA_DIR = path.join(__dirname, "schema");

// Tables ordered by foreign key dependency
const SCHEMA_FILES = [
  "users.sql",
  "apartments.sql",
  "residents.sql",
  "incomes.sql",
  "expenses.sql",
  "dues.sql",
  "due_payments.sql",
  "payment_cancellations.sql",
];

function loadSchema(db) {
  db.transaction(() => {
    for (const file of SCHEMA_FILES) {
      const sql = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8");
      try {
        db.exec(sql);
      } catch (e) {
        e.message = `Failed to load schema: ${file} — ${e.message}`;
        throw e;
      }
    }
  })();
}

function runMigrations(db) {
  // Migrations table must exist before anything else
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return 0;
  }

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

  const recordMigration = db.prepare(`INSERT INTO migrations (filename) VALUES (?)`);

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    if (!sql.trim()) {
      console.warn(`Migration skipped (empty file): ${file}`);
      db.transaction(() => recordMigration.run(file))();
      continue;
    }

    try {
      db.transaction(() => {
        db.exec(sql);
        recordMigration.run(file);
      })();
      console.log(`Migration applied: ${file}`);
      appliedCount++;
    } catch (err) {
      // ALTER TABLE ADD COLUMN fails if the column already exists (SQLite has no IF NOT EXISTS).
      // Treat this as a no-op so the migration is still recorded and won't re-run.
      if (err.message.includes("duplicate column name") || err.message.includes("no such table")) {
        // duplicate column name: column already exists (upgrade path)
        // no such table: fresh install, schema loader will create the table with all columns
        db.transaction(() => recordMigration.run(file))();
        console.warn(`Migration skipped (handled by schema): ${file} — ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  // Fresh install: migrations above fail with "no such table" and are skipped,
  // so loadSchema creates all tables here. Existing installs: no-op (IF NOT EXISTS).
  loadSchema(db);

  return appliedCount;
}

module.exports = { runMigrations };

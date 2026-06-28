const fs = require("fs");
const path = require("path");

// Applies one-off changes (e.g. ALTER TABLE) to existing installations.
// Each migration runs inside a transaction; failure rolls back the entire change.
// "duplicate column name" / "no such table" are expected on fresh installs where
// tables don't exist yet — the migration is marked applied because loadSchema will create them.
function applyMigrations(db) {
  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedMigrations = new Set(
    db
      .prepare(`SELECT filename FROM migrations`)
      .all()
      .map((r) => r.filename),
  );

  const recordMigration = db.prepare(`INSERT INTO migrations (filename) VALUES (?)`);

  for (const file of files) {
    if (appliedMigrations.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    if (!sql.trim()) {
      console.warn(`[Migrate] Migration skipped (empty file): ${file}`);
      db.transaction(() => recordMigration.run(file))();
      continue;
    }

    try {
      db.pragma("foreign_keys = OFF");
      db.transaction(() => {
        db.exec(sql);
        recordMigration.run(file);
      })();
      db.pragma("foreign_keys = ON");
      console.log(`[Migrate] Migration applied: ${file}`);
    } catch (err) {
      db.pragma("foreign_keys = ON");
      // SQLite has no ALTER TABLE IF NOT EXISTS; these two errors are expected
      if (err.message.includes("duplicate column name") || err.message.includes("no such table")) {
        db.transaction(() => recordMigration.run(file))();
        console.warn(`[Migrate] Migration skipped: ${file} — ${err.message}`);
      } else {
        throw err;
      }
    }
  }
}

// Loads schema files containing CREATE TABLE/TRIGGER IF NOT EXISTS statements.
// Creates all tables on fresh installs; no-op on existing installations.
// File name prefix (01_, 02_, …) determines load order.
function loadSchema(db) {
  const schemaDir = path.join(__dirname, "schema");
  const schemaFiles = fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of schemaFiles) {
    const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");
    try {
      db.exec(sql);
    } catch (e) {
      e.message = `[Migrate] Failed to load schema: ${file} — ${e.message}`;
      throw e;
    }
  }
}

// Called by main.js on every startup. Order matters:
// migrations first, then schema — ensures existing tables are aligned before schema is re-applied.
function runMigrations(db) {
  applyMigrations(db);
  loadSchema(db);
}

module.exports = { runMigrations };

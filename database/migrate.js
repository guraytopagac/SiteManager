const fs = require("fs");
const path = require("path");

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

  function runSingleMigration(file, sql) {
    try {
      db.pragma("foreign_keys = OFF");
      db.transaction(() => {
        db.exec(sql);
        recordMigration.run(file);
      })();
      console.warn(`[Migrate] Migration applied: ${file}`);
    } catch (err) {
      if (err.message.includes("duplicate column name") || err.message.includes("no such table")) {
        db.transaction(() => recordMigration.run(file))();
        console.warn(`[Migrate] Migration skipped: ${file} — ${err.message}`);
      } else {
        throw err;
      }
    } finally {
      db.pragma("foreign_keys = ON");
    }
  }

  for (const file of files) {
    if (appliedMigrations.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    if (!sql.trim()) {
      console.warn(`[Migrate] Migration skipped (empty file): ${file}`);
      db.transaction(() => recordMigration.run(file))();
      continue;
    }

    runSingleMigration(file, sql);
  }
}

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

function runMigrations(db) {
  applyMigrations(db);
  loadSchema(db);
}

module.exports = { runMigrations };

// Runs at every startup: migrations first, then the schema files. A failure here stops the app.
const fs = require("fs");
const path = require("path");

// Runs the migrations that have not run yet, in file name order, one transaction each.
function applyMigrations(db) {
  const migrationsDir = path.join(__dirname, "migrations");

  // The packager may drop an empty folder, so a missing folder must not break startup.
  if (!fs.existsSync(migrationsDir)) return;

  // Created here, not in schema/, because it is needed before the schema step runs.
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
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

  const isFreshInstall = !db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1`).get();

  // Fresh install: the schema step already builds the current tables, so migrations are only marked.
  if (isFreshInstall) {
    const pendingMigrations = files.filter((file) => !appliedMigrations.has(file));
    db.transaction(() => {
      for (const migration of pendingMigrations) recordMigration.run(migration);
    })();
    console.warn(`[Migrate] Fresh install, ${pendingMigrations.length} migrations marked applied`);
    return;
  }

  for (const file of files) {
    if (appliedMigrations.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    try {
      // Foreign keys are off while the file runs, then checked once before the commit.
      db.pragma("foreign_keys = OFF");
      db.transaction(() => {
        db.exec(sql);
        const violations = db.pragma("foreign_key_check");
        if (violations.length > 0) {
          throw new Error(`foreign key violations (${violations.length}), migration rolled back`);
        }
        recordMigration.run(file);
      })();
    } finally {
      db.pragma("foreign_keys = ON");
    }

    console.warn(`[Migrate] Migration applied: ${file}`);
  }
}

// Every statement is IF NOT EXISTS, so this does nothing on an existing install.
function loadSchema(db) {
  const schemaDir = path.join(__dirname, "schema");

  const schemaFiles = fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  db.transaction(() => {
    for (const file of schemaFiles) {
      const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");
      try {
        db.exec(sql);
      } catch (e) {
        // Name the failing file, or the startup error box points at nothing.
        e.message = `[Migrate] Failed to load schema (${file}): ${e.message}`;
        throw e;
      }
    }
  })();
}

function runMigrations(db) {
  applyMigrations(db);
  loadSchema(db);
}

module.exports = { runMigrations };

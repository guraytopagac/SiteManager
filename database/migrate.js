const fs = require("fs");
const path = require("path");

function applyMigrations(db) {
  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) return;

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

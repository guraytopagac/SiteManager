const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "admin@mavikent.com";

// Called on first launch. No-op if an admin account already exists.
// Returns { username, password } when a new account is created; main.js shows it to the user via dialog.
// The plaintext password lives in memory only at this point — it cannot be recovered later.
async function seedAdminAccount(db) {
  const existing = db.prepare(`SELECT username, email FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (existing) return { alreadyExists: true, ...existing };

  const randomPassword = crypto.randomBytes(16).toString("hex");

  try {
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    db.prepare(`INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)`).run(
      DEFAULT_ADMIN_USERNAME,
      DEFAULT_ADMIN_EMAIL,
      hashedPassword,
    );
  } catch (err) {
    console.error("[Seed] Failed to create admin account:", err.message);
    throw err;
  }

  return { username: DEFAULT_ADMIN_USERNAME, password: randomPassword };
}

module.exports = { seedAdminAccount };

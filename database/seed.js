const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "admin@mavikent.com";
const BCRYPT_SALT_ROUNDS = 12;

async function seedAdminAccount(db) {
  const existing = db.prepare(`SELECT username, email FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1`).get();
  if (existing) return { alreadyExists: true, ...existing };

  const randomPassword = crypto.randomBytes(16).toString("hex");

  try {
    const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_SALT_ROUNDS);
    db.transaction(() => {
      db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
        DEFAULT_ADMIN_USERNAME,
        DEFAULT_ADMIN_EMAIL,
        hashedPassword,
        "admin",
      );
    })();
  } catch (err) {
    console.error("[seed] Failed to create admin account:", err.message);
    throw err;
  }

  return { username: DEFAULT_ADMIN_USERNAME, password: randomPassword };
}

module.exports = { seedAdminAccount };

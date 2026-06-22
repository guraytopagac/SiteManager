const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "admin@mavikent.com";
const BCRYPT_SALT_ROUNDS = 12;

async function seedAdminAccount(db) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1`).get();
  if (count > 0) return null;

  const randomPassword = crypto.randomBytes(8).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_SALT_ROUNDS);

  try {
    db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
      DEFAULT_ADMIN_USERNAME,
      DEFAULT_ADMIN_EMAIL,
      hashedPassword,
      "admin",
    );
  } catch (err) {
    console.error("[seed] Admin oluşturulamadı:", err.message);
    return null;
  }

  return { username: DEFAULT_ADMIN_USERNAME, password: randomPassword };
}

module.exports = { seedAdminAccount };

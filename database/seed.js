const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function seedAdminAccount(db) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).get();
  if (count > 0) return null;

  const randomPassword = crypto.randomBytes(6).toString("hex");
  const hashedPassword = bcrypt.hashSync(randomPassword, 12);

  db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
    "admin",
    "admin@mavikent.com",
    hashedPassword,
    "admin",
  );

  return randomPassword;
}

module.exports = { seedAdminAccount };

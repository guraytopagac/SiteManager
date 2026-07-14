const crypto = require("crypto");

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "guray.topagac.dev@gmail.com";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 16;

function generateRecoveryCode() {
  const rawCode = Array.from(
    { length: RECOVERY_LENGTH },
    () => RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)],
  ).join("");

  const groups = [];
  for (let i = 0; i < rawCode.length; i += 4) {
    groups.push(rawCode.slice(i, i + 4));
  }

  const displayCode = groups.join("-");

  return { rawCode, displayCode };
}

function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function seedAdminAccount(db) {
  const existing = db.prepare(`SELECT username, email FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (existing) return { alreadyExists: true, ...existing };

  try {
    db.prepare(
      `INSERT INTO users (username, email, password_hash, recovery_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, 'SETUP_PENDING', NULL, 'admin', 1, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
    ).run(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL);
  } catch (err) {
    console.error("[Seed] Failed to create admin account:", err.message);
    throw err;
  }

  return { username: DEFAULT_ADMIN_USERNAME };
}

module.exports = {
  seedAdminAccount,
  generateRecoveryCode,
  normalizeRecoveryCode,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_EMAIL,
};

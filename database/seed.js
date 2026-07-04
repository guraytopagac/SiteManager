const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_EMAIL = "guray.topagac.dev@gmail.com";
const BCRYPT_ROUNDS = 12;

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

  const display = groups.join("-");

  return { rawCode, display };
}

// Normalize user input back to canonical form before comparing against the stored hash.
function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Called on first launch. No-op if an admin account already exists.
// main.js shows these to the user via dialog.
async function seedAdminAccount(db) {
  const existing = db.prepare(`SELECT username, email FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (existing) return { alreadyExists: true, ...existing };

  const randomPassword = crypto.randomBytes(16).toString("hex");
  const recovery = generateRecoveryCode();

  try {
    const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);
    const recoveryHash = await bcrypt.hash(recovery.rawCode, BCRYPT_ROUNDS);
    db.prepare(
      `INSERT INTO users (username, email, password_hash, recovery_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'admin', 1)`,
    ).run(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hashedPassword, recoveryHash);
  } catch (err) {
    console.error("[Seed] Failed to create admin account:", err.message);
    throw err;
  }

  return { username: DEFAULT_ADMIN_USERNAME, password: randomPassword, recoveryCode: recovery.display };
}

module.exports = {
  seedAdminAccount,
  generateRecoveryCode,
  normalizeRecoveryCode,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_EMAIL,
};

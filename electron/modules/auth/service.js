const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL } = require("../shared/trTime");

const COLUMN_LABELS = {
  username: "Kullanıcı adı",
  manager_name: "Ad Soyad",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

const BCRYPT_ROUNDS = 12;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PASSWORD_LENGTH = 12;
const RECOVERY_LENGTH = 16;
const RECOVERY_GROUP_RE = /.{1,4}/g;
const DUMMY_HASH = "$2b$12$3X/2XNSPPTIIRZLnRyDSAOjqjj3mreEYkyjbWyz7RkwJbe0MBr8l.";

const ACCOUNT_NOT_FOUND_MESSAGE = "Hesap bulunamadı.";
const INVALID_CREDENTIALS_MESSAGE = "Kullanıcı Adı / Şifre Hatalı!";
const INVALID_PASSWORD_MESSAGE = "Mevcut şifre hatalı.";
const INVALID_RECOVERY_MESSAGE = "Kurtarma kodu hatalı.";
const NO_ACCOUNT_MESSAGE =
  "Bu bilgisayarda kurulu bir hesap bulunamadı. Uygulamayı yeniden başlatıp kurulumu tamamlayın.";

function randomCode(length) {
  return Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");
}

function generateRecoveryCode() {
  const rawCode = randomCode(RECOVERY_LENGTH);
  return { rawCode, displayCode: rawCode.match(RECOVERY_GROUP_RE).join("-") };
}

function generateTemporaryPassword() {
  return randomCode(TEMP_PASSWORD_LENGTH);
}

function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function findAccount() {
  return getDb().prepare(`SELECT id, username, password_hash, recovery_hash FROM users ORDER BY id LIMIT 1`).get();
}

function checkRecoveryCode(account, recoveryCode) {
  if (!account) {
    return { success: false, message: NO_ACCOUNT_MESSAGE };
  }
  if (!bcrypt.compareSync(normalizeRecoveryCode(recoveryCode), account.recovery_hash)) {
    return { success: false, code: "INVALID_RECOVERY_CODE", message: INVALID_RECOVERY_MESSAGE };
  }
  return null;
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    managerName: user.manager_name,
    lastLogin: user.last_login,
  };
}

function login(credentials) {
  try {
    const user = getDb()
      .prepare(
        `SELECT id, username, email, manager_name, password_hash, last_login
         FROM users WHERE username = ? AND is_active = 1`,
      )
      .get(credentials.username);

    if (!user) {
      bcrypt.compareSync(credentials.password, DUMMY_HASH);
      return { success: false, message: INVALID_CREDENTIALS_MESSAGE };
    }

    if (!bcrypt.compareSync(credentials.password, user.password_hash)) {
      return { success: false, message: INVALID_CREDENTIALS_MESSAGE };
    }

    getDb()
      .prepare(`UPDATE users SET last_login = ${TR_NOW_SQL}, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
      .run(user.id);

    return { success: true, user: toSafeUser(user) };
  } catch (err) {
    console.error("[auth.service] login:", err);
    return { success: false, message: "Giriş yapılamadı. Lütfen tekrar deneyin." };
  }
}

function transferAccount(payload) {
  const { userId, password, newPerson } = payload;
  try {
    const user = getDb().prepare(`SELECT id, password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: ACCOUNT_NOT_FOUND_MESSAGE };
    if (!bcrypt.compareSync(password, user.password_hash)) return { success: false, message: INVALID_PASSWORD_MESSAGE };

    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordHash = bcrypt.hashSync(temporaryPassword, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);

    getDb()
      .prepare(
        `UPDATE users SET password_hash = ?, manager_name = ?, recovery_hash = ?,
         password_changed_at = ${TR_NOW_SQL}, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(temporaryPasswordHash, newPerson, newRecoveryHash, userId);

    return {
      success: true,
      message: "Hesap devri tamamlandı.",
      temporaryPassword,
      recoveryCode: newRecoveryCode.displayCode,
    };
  } catch (err) {
    console.error("[auth.service] transferAccount:", err);
    return { success: false, message: "Devir tamamlanamadı." };
  }
}

function changePassword(payload) {
  const { userId, oldPassword, newPassword } = payload;
  try {
    const user = getDb().prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: ACCOUNT_NOT_FOUND_MESSAGE };
    if (!bcrypt.compareSync(oldPassword, user.password_hash))
      return { success: false, message: INVALID_PASSWORD_MESSAGE };
    if (bcrypt.compareSync(newPassword, user.password_hash))
      return { success: false, message: "Yeni şifre eski şifreyle aynı olamaz." };

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    getDb()
      .prepare(
        `UPDATE users SET password_hash = ?, password_changed_at = ${TR_NOW_SQL},
         updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(newPasswordHash, userId);
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch (err) {
    console.error("[auth.service] changePassword:", err);
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

function updateEmail(payload) {
  const { userId, email } = payload;
  try {
    const result = getDb()
      .prepare(`UPDATE users SET email = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
      .run(email, userId);

    if (result.changes === 0) return { success: false, message: ACCOUNT_NOT_FOUND_MESSAGE };

    return {
      success: true,
      message: email ? "E-posta adresi güncellendi." : "E-posta adresi kaldırıldı.",
      email,
    };
  } catch (err) {
    console.error("[auth.service] updateEmail:", err);
    return { success: false, message: resolveDbError(err, "E-posta güncelleme") };
  }
}

function resetAccountPassword(payload) {
  const { recoveryCode, newPassword } = payload;
  try {
    const account = findAccount();
    const recoveryError = checkRecoveryCode(account, recoveryCode);
    if (recoveryError) return recoveryError;

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    getDb()
      .prepare(
        `UPDATE users SET password_hash = ?, password_changed_at = ${TR_NOW_SQL}, recovery_hash = ?,
         updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(newPasswordHash, newRecoveryHash, account.id);

    return {
      success: true,
      message: "Hesap şifresi sıfırlandı.",
      recoveryCode: newRecoveryCode.displayCode,
      username: account.username,
    };
  } catch (err) {
    console.error("[auth.service] resetAccountPassword:", err);
    return { success: false, message: "Şifre sıfırlanamadı." };
  }
}

function verifyRecoveryCode(payload) {
  try {
    return checkRecoveryCode(findAccount(), payload.recoveryCode) ?? { success: true };
  } catch (err) {
    console.error("[auth.service] verifyRecoveryCode:", err);
    return { success: false, message: "Kurtarma kodu doğrulanamadı." };
  }
}

function regenerateRecoveryCode(payload) {
  const { password } = payload;
  try {
    const account = findAccount();
    if (!account) return { success: false, message: ACCOUNT_NOT_FOUND_MESSAGE };
    if (!bcrypt.compareSync(password, account.password_hash)) return { success: false, message: "Şifre hatalı." };

    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    getDb()
      .prepare(`UPDATE users SET recovery_hash = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
      .run(newRecoveryHash, account.id);

    return { success: true, message: "Yeni kurtarma kodu oluşturuldu.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] regenerateRecoveryCode:", err);
    return { success: false, message: "Kurtarma kodu oluşturulamadı." };
  }
}

function getSetupState() {
  try {
    const account = findAccount();
    return { success: true, needsSetup: !account, username: account?.username ?? null };
  } catch (err) {
    console.error("[auth.service] getSetupState:", err);
    return { success: false, message: "Kurulum durumu alınamadı." };
  }
}

function completeSetup(payload) {
  const { username, password, managerName } = payload;
  try {
    if (findAccount()) return { success: false, message: "Kurulum zaten tamamlanmış." };

    const newPasswordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);

    getDb()
      .prepare(
        `INSERT INTO users (username, password_hash, manager_name, recovery_hash, is_active, password_changed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ${TR_NOW_SQL}, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(username, newPasswordHash, managerName, newRecoveryHash);

    return { success: true, message: "Hesabınız kuruldu.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] completeSetup:", err);
    return { success: false, message: resolveDbError(err, "Kurulum") };
  }
}

module.exports = {
  login,
  transferAccount,
  changePassword,
  updateEmail,
  resetAccountPassword,
  verifyRecoveryCode,
  regenerateRecoveryCode,
  getSetupState,
  completeSetup,
};

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");

const COLUMN_LABELS = {
  username: "Kullanıcı adı",
  email: "E-posta adresi",
  manager_name: "Ad Soyad",
};

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

const BCRYPT_ROUNDS = 12;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PASSWORD_LENGTH = 12;
const RECOVERY_LENGTH = 16;
const DUMMY_HASH = "$2b$12$3X/2XNSPPTIIRZLnRyDSAOjqjj3mreEYkyjbWyz7RkwJbe0MBr8l.";

function generateRecoveryCode() {
  const rawCode = Array.from(
    { length: RECOVERY_LENGTH },
    () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)],
  ).join("");

  const groups = [];
  for (let i = 0; i < rawCode.length; i += 4) {
    groups.push(rawCode.slice(i, i + 4));
  }

  return { rawCode, displayCode: groups.join("-") };
}

function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    managerName: user.manager_name,
    last_login: user.last_login,
  };
}

function login(credentials) {
  try {
    if (!credentials?.username || !credentials?.password)
      return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };

    const user = getDb()
      .prepare(
        `SELECT id, username, email, manager_name, password_hash, last_login
         FROM users WHERE username = ? AND is_active = 1`,
      )
      .get(credentials.username);

    if (!user) {
      bcrypt.compareSync(credentials.password, DUMMY_HASH);
      return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
    }

    if (bcrypt.compareSync(credentials.password, user.password_hash)) {
      getDb().prepare(
        `UPDATE users SET last_login = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours')
         WHERE id = ?`,
      ).run(user.id);

      return { success: true, user: toSafeUser(user) };
    }

    return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
  } catch (err) {
    console.error("[auth.service] login:", err);
    return { success: false, message: "Giriş yapılamadı. Lütfen tekrar deneyin." };
  }
}

function generateTemporaryPassword() {
  return Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)],
  ).join("");
}

function transferAccount(userId, password, newPerson) {
  try {
    const user = getDb().prepare(`SELECT id, password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: "Hesap bulunamadı." };
    if (!bcrypt.compareSync(password || "", user.password_hash))
      return { success: false, message: "Mevcut şifre hatalı." };

    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordHash = bcrypt.hashSync(temporaryPassword, BCRYPT_ROUNDS);
    getDb().prepare(
      `UPDATE users SET password_hash = ?, manager_name = ?, password_changed_at = datetime('now', '+3 hours'),
       updated_at = datetime('now', '+3 hours') WHERE id = ?`,
    ).run(temporaryPasswordHash, newPerson, userId);

    return { success: true, message: "Hesap devri tamamlandı.", temporaryPassword };
  } catch (err) {
    console.error("[auth.service] transferAccount:", err);
    return { success: false, message: "Devir tamamlanamadı." };
  }
}

function changePassword(userId, oldPassword, newPassword) {
  try {
    if (!newPassword || newPassword.length < 8) return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    const user = getDb().prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: "Kullanıcı bulunamadı." };
    if (!oldPassword || !bcrypt.compareSync(oldPassword, user.password_hash))
      return { success: false, message: "Mevcut şifre hatalı." };
    if (bcrypt.compareSync(newPassword, user.password_hash))
      return { success: false, message: "Yeni şifre eski şifreyle aynı olamaz." };

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    getDb().prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now', '+3 hours'),
       updated_at = datetime('now', '+3 hours') WHERE id = ?`,
    ).run(newPasswordHash, userId);
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch (err) {
    console.error("[auth.service] changePassword:", err);
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

function updateEmail(userId, email) {
  try {
    const account = getDb().prepare(`SELECT id FROM users WHERE id = ?`).get(userId);
    if (!account) return { success: false, message: "Hesap bulunamadı." };

    getDb().prepare(`UPDATE users SET email = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`).run(email, userId);

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

function resetAccountPassword(recoveryCode, newPassword) {
  try {
    if (!newPassword || newPassword.length < 8)
      return { success: false, message: "Yeni şifre en az 8 karakter olmalıdır." };

    const account = getDb()
      .prepare(`SELECT id, username, recovery_hash FROM users WHERE recovery_hash IS NOT NULL LIMIT 1`)
      .get();
    if (!account || !account.recovery_hash) {
      bcrypt.compareSync("dummy", DUMMY_HASH);
      return { success: false, message: "Kurtarma kodu tanımlı değil. Lütfen destek ile iletişime geçin." };
    }

    const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCode);
    if (!bcrypt.compareSync(normalizedRecoveryCode || "", account.recovery_hash))
      return { success: false, code: "INVALID_RECOVERY_CODE", message: "Kurtarma kodu hatalı." };

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    getDb().prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now', '+3 hours'), recovery_hash = ?,
       updated_at = datetime('now', '+3 hours') WHERE id = ?`,
    ).run(newPasswordHash, newRecoveryHash, account.id);

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

function verifyRecoveryCode(recoveryCode) {
  try {
    const account = getDb()
      .prepare(`SELECT recovery_hash FROM users WHERE recovery_hash IS NOT NULL LIMIT 1`)
      .get();
    if (!account || !account.recovery_hash) {
      bcrypt.compareSync("dummy", DUMMY_HASH);
      return { success: false, message: "Kurtarma kodu tanımlı değil. Lütfen destek ile iletişime geçin." };
    }

    const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCode);
    if (!bcrypt.compareSync(normalizedRecoveryCode || "", account.recovery_hash))
      return { success: false, code: "INVALID_RECOVERY_CODE", message: "Kurtarma kodu hatalı." };

    return { success: true };
  } catch (err) {
    console.error("[auth.service] verifyRecoveryCode:", err);
    return { success: false, message: "Kurtarma kodu doğrulanamadı." };
  }
}

function regenerateRecoveryCode(password) {
  try {
    const account = getDb().prepare(`SELECT id, password_hash FROM users ORDER BY id LIMIT 1`).get();
    if (!account) {
      bcrypt.compareSync("dummy", DUMMY_HASH);
      return { success: false, message: "Hesap bulunamadı." };
    }
    if (!bcrypt.compareSync(password || "", account.password_hash)) return { success: false, message: "Şifre hatalı." };

    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    getDb().prepare(
      `UPDATE users SET recovery_hash = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?`,
    ).run(newRecoveryHash, account.id);

    return { success: true, message: "Yeni kurtarma kodu oluşturuldu.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] regenerateRecoveryCode:", err);
    return { success: false, message: "Kurtarma kodu oluşturulamadı." };
  }
}

function getSetupState() {
  try {
    const account = getDb().prepare(`SELECT username, password_changed_at FROM users ORDER BY id LIMIT 1`).get();
    const needsSetup = !account || account.password_changed_at == null;
    return { success: true, needsSetup, username: needsSetup ? null : (account?.username ?? null) };
  } catch (err) {
    console.error("[auth.service] getSetupState:", err);
    return { success: false, message: "Kurulum durumu alınamadı." };
  }
}

function completeSetup(username, password, managerName) {
  try {
    if (!password || password.length < 8) return { success: false, message: "Şifre en az 8 karakter olmalıdır." };

    const account = getDb().prepare(`SELECT id, password_changed_at FROM users ORDER BY id LIMIT 1`).get();
    if (account && account.password_changed_at != null) return { success: false, message: "Kurulum zaten tamamlanmış." };

    const newPasswordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);

    if (account) {
      getDb().prepare(
        `UPDATE users SET username = ?, password_hash = ?, manager_name = ?,
         password_changed_at = datetime('now', '+3 hours'), recovery_hash = ?,
         updated_at = datetime('now', '+3 hours') WHERE id = ?`,
      ).run(username, newPasswordHash, managerName, newRecoveryHash, account.id);
    } else {
      getDb().prepare(
        `INSERT INTO users (username, password_hash, manager_name, recovery_hash, is_active, password_changed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now', '+3 hours'), datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
      ).run(username, newPasswordHash, managerName, newRecoveryHash);
    }

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

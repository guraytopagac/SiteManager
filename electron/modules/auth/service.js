// Auth rules. There is one account, so every lookup takes the first row by id. Passwords and
// recovery codes are stored as bcrypt hashes. The only value ever returned in clear text is a
// new recovery code, shown to the user once.
const crypto = require("crypto");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { getDb } = require("../../../database/db");
const { saveDatabaseCopy } = require("../backup/service");
const { createDbErrorResolver } = require("../shared/dbError");
const { TR_NOW_SQL, trToday } = require("../shared/trTime");

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
// Compared against when no user matches, so login takes about the same time either way.
const DUMMY_HASH = "$2b$12$3X/2XNSPPTIIRZLnRyDSAOjqjj3mreEYkyjbWyz7RkwJbe0MBr8l.";

const ACCOUNT_NOT_FOUND_MESSAGE = "Hesap bulunamadı.";
const INVALID_CREDENTIALS_MESSAGE = "Kullanıcı Adı / Şifre Hatalı!";
const INVALID_PASSWORD_MESSAGE = "Mevcut şifre hatalı.";
const INVALID_RECOVERY_MESSAGE = "Kurtarma kodu hatalı.";
const NO_ACCOUNT_MESSAGE =
  "Bu bilgisayarda kurulu bir hesap bulunamadı. Uygulamayı yeniden başlatıp kurulumu tamamlayın.";

// The alphabet has no I, O, 0 or 1, so a written code cannot be misread.
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

// Accepts dashes, spaces and lower case when the user types the code back in.
function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// The one account row. No row means setup is not done yet.
// startYear is the year the account row was written, which is also the first year that can hold
// any data. The renderer uses it as the floor of every period selector.
function findAccount() {
  return getDb()
    .prepare(
      `SELECT id, username, password_hash, recovery_hash,
              CAST(strftime('%Y', created_at) AS INTEGER) AS startYear
       FROM users ORDER BY id LIMIT 1`,
    )
    .get();
}

// Used by reset and verify. It returns a code field, because the renderer checks that field.
function checkRecoveryCode(account, recoveryCode) {
  if (!account) {
    return { success: false, message: NO_ACCOUNT_MESSAGE };
  }
  if (!bcrypt.compareSync(normalizeRecoveryCode(recoveryCode), account.recovery_hash)) {
    return { success: false, code: "INVALID_RECOVERY_CODE", message: INVALID_RECOVERY_MESSAGE };
  }
  return null;
}

// The only user object the renderer ever sees. The hash columns are left out.
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
      // A fake compare, so a missing user takes about as long as a wrong password. It only helps
      // here, because the recovery pages already tell you whether an account exists.
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

const TRANSFER_SQL = `UPDATE users SET username = ?, email = NULL, password_hash = ?, manager_name = ?,
  recovery_hash = ?, password_changed_at = ${TR_NOW_SQL}, updated_at = ${TR_NOW_SQL} WHERE id = ?`;

// Hands the account to another person. Buildings and data stay where they are. The recovery code
// is replaced too, or the old holder could use their code to get back in. The username and email
// go for the same reason the name does: they belong to the person, not to the ledger.
// A transfer always writes a transfer file, whether the new manager stays on this computer or not.
// The new credentials go into a copy of the database first and then into this one, so the file
// never carries the old password and this computer is locked to the previous manager as well.
async function transferAccount(payload, mainWindow) {
  const { userId, password, newPerson, newUsername } = payload;
  let filePath = null;
  try {
    const user = getDb().prepare(`SELECT id, username, password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: ACCOUNT_NOT_FOUND_MESSAGE };
    if (!bcrypt.compareSync(password, user.password_hash)) return { success: false, message: INVALID_PASSWORD_MESSAGE };
    // Usernames are ASCII only, so a plain lower-case compare matches the NOCASE index.
    if (user.username.toLowerCase() === newUsername.toLowerCase()) {
      return { success: false, message: "Yeni kullanıcı adı mevcut kullanıcı adından farklı olmalıdır." };
    }

    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordHash = bcrypt.hashSync(temporaryPassword, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    const params = [newUsername, temporaryPasswordHash, newPerson, newRecoveryHash, userId];

    filePath = await saveDatabaseCopy(mainWindow, {
      title: "Devir Dosyasını Kaydet",
      defaultPath: `mavikent-devir-${trToday()}.db`,
      editCopy: (copyDb) => {
        if (copyDb.prepare(TRANSFER_SQL).run(...params).changes !== 1) {
          throw new Error("transferAccount: account row missing in the copy");
        }
      },
    });
    if (!filePath) return { success: false, cancelled: true, message: "İptal edildi." };

    getDb()
      .prepare(TRANSFER_SQL)
      .run(...params);

    return {
      success: true,
      message: "Hesap devri tamamlandı.",
      managerName: newPerson,
      username: newUsername,
      temporaryPassword,
      recoveryCode: newRecoveryCode.displayCode,
      filePath,
    };
  } catch (err) {
    console.error("[auth.service] transferAccount:", err);
    // A file whose twin write here failed would hand over credentials this computer never got.
    if (filePath) await fs.promises.unlink(filePath).catch(() => {});
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
    return { success: true, message: "Şifreniz değiştirildi." };
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

// Called from /recover without a session. The code is single use, so a new one is issued and
// the username is returned with it.
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

// Step one of /recover. It changes nothing, so the user sees the error before typing a password.
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

// Used by the startup redirect and to fill in the username on the login page.
function getSetupState() {
  try {
    const account = findAccount();
    return {
      success: true,
      needsSetup: !account,
      username: account?.username ?? null,
      startYear: account?.startYear ?? null,
    };
  } catch (err) {
    console.error("[auth.service] getSetupState:", err);
    return { success: false, message: "Kurulum durumu alınamadı." };
  }
}

// Creates the one account row. It works only while no account exists, and INSERT is its only write.
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

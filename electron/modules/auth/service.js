const bcrypt = require("bcryptjs");
const { db } = require("../../../database/db");
const { generateRecoveryCode, normalizeRecoveryCode } = require("../../../database/seed");

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = "$2b$12$3X/2XNSPPTIIRZLnRyDSAOjqjj3mreEYkyjbWyz7RkwJbe0MBr8l.";

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    last_login: user.last_login,
  };
}

function login(credentials) {
  try {
    if (!credentials?.username || !credentials?.password)
      return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };

    const user = db
      .prepare(
        `SELECT id, username, email, password_hash, role, last_login
         FROM users WHERE username = ? AND is_active = 1`,
      )
      .get(credentials.username);

    if (!user) {
      bcrypt.compareSync(credentials.password, DUMMY_HASH);
      return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
    }

    if (bcrypt.compareSync(credentials.password, user.password_hash)) {
      db.prepare(`UPDATE users SET last_login = datetime('now', '+3 hours') WHERE id = ?`).run(user.id);

      return { success: true, user: toSafeUser(user) };
    }

    return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
  } catch (err) {
    console.error("[auth.service] login:", err);
    return { success: false, message: "Veritabanı hatası. Lütfen hakkında kısmından bilgi alınız." };
  }
}

function getManagers() {
  try {
    const data = db
      .prepare(`SELECT id, username, email, is_active, last_login FROM users WHERE role = 'manager' ORDER BY id ASC`)
      .all();
    return { success: true, data };
  } catch (err) {
    console.error("[auth.service] getManagers:", err);
    return { success: false, message: "Site yöneticisi listesi alınamadı." };
  }
}

function createManager(managerData) {
  try {
    const hashedPassword = bcrypt.hashSync(managerData.password, BCRYPT_ROUNDS);
    db.prepare(
      `INSERT INTO users (username, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now', '+3 hours'), datetime('now', '+3 hours'))`,
    ).run(
      managerData.username,
      managerData.email,
      hashedPassword,
    );
    return { success: true, message: "Site yöneticisi hesabı başarıyla oluşturuldu." };
  } catch (err) {
    console.error("[auth.service] createManager:", err.message);
    if (err.message?.includes("UNIQUE"))
      return { success: false, message: "Bu kullanıcı adı veya e-posta zaten kullanımda." };
    if (err.message?.includes("CHECK"))
      return { success: false, message: "Geçersiz kullanıcı adı veya e-posta formatı." };
    return { success: false, message: "Hesap oluşturulamadı." };
  }
}

function updateManagerStatus(id, isActive) {
  try {
    const result = db
      .prepare(`UPDATE users SET is_active = ? WHERE id = ? AND role = 'manager'`)
      .run(isActive ? 1 : 0, id);
    if (result.changes === 0) return { success: false, message: "Site yöneticisi bulunamadı." };
    const msg = isActive ? "Site yöneticisi hesabı aktif edildi." : "Site yöneticisi hesabı deaktif edildi.";
    return { success: true, message: msg };
  } catch (err) {
    console.error("[auth.service] updateManagerStatus:", err);
    return { success: false, message: "İşlem gerçekleştirilemedi." };
  }
}

function changePassword(userId, oldPassword, newPassword) {
  try {
    if (!newPassword || newPassword.length < 8) return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: "Kullanıcı bulunamadı." };
    if (!oldPassword || !bcrypt.compareSync(oldPassword, user.password_hash))
      return { success: false, message: "Mevcut şifre hatalı." };
    if (bcrypt.compareSync(newPassword, user.password_hash))
      return { success: false, message: "Yeni şifre eski şifreyle aynı olamaz." };

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    db.prepare(`UPDATE users SET password_hash = ?, password_changed_at = datetime('now', '+3 hours') WHERE id = ?`).run(
      newPasswordHash,
      userId,
    );
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch (err) {
    console.error("[auth.service] changePassword:", err);
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

function resetAdminPassword(recoveryCode, newPassword) {
  try {
    if (!newPassword || newPassword.length < 8)
      return { success: false, message: "Yeni şifre en az 8 karakter olmalıdır." };

    const admin = db.prepare(`SELECT id, recovery_hash FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!admin || !admin.recovery_hash) {
      bcrypt.compareSync("dummy", DUMMY_HASH);
      return { success: false, message: "Kurtarma kodu tanımlı değil. Lütfen destek ile iletişime geçin." };
    }

    const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCode);
    if (!bcrypt.compareSync(normalizedRecoveryCode || "", admin.recovery_hash))
      return { success: false, message: "Kurtarma kodu hatalı." };

    const newPasswordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now', '+3 hours'), recovery_hash = ? WHERE id = ?`,
    ).run(newPasswordHash, newRecoveryHash, admin.id);

    return { success: true, message: "Admin şifresi sıfırlandı.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] resetAdminPassword:", err);
    return { success: false, message: "Şifre sıfırlanamadı." };
  }
}

function regenerateRecoveryCode(password) {
  try {
    const admin = db.prepare(`SELECT id, password_hash FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!admin) {
      bcrypt.compareSync("dummy", DUMMY_HASH);
      return { success: false, message: "Admin hesabı bulunamadı." };
    }
    if (!bcrypt.compareSync(password || "", admin.password_hash)) return { success: false, message: "Şifre hatalı." };

    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    db.prepare(`UPDATE users SET recovery_hash = ? WHERE id = ?`).run(newRecoveryHash, admin.id);

    return { success: true, message: "Yeni kurtarma kodu oluşturuldu.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] regenerateRecoveryCode:", err);
    return { success: false, message: "Kurtarma kodu oluşturulamadı." };
  }
}

function getSetupState() {
  try {
    const admin = db.prepare(`SELECT password_changed_at FROM users WHERE role = 'admin' LIMIT 1`).get();
    const needsSetup = !!admin && admin.password_changed_at == null;
    return { success: true, needsSetup };
  } catch (err) {
    console.error("[auth.service] getSetupState:", err);
    return { success: false, message: "Kurulum durumu alınamadı." };
  }
}

function completeAdminSetup(password) {
  try {
    if (!password || password.length < 8) return { success: false, message: "Şifre en az 8 karakter olmalıdır." };

    const admin = db.prepare(`SELECT id, password_changed_at FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!admin) return { success: false, message: "Admin hesabı bulunamadı." };
    if (admin.password_changed_at != null) return { success: false, message: "Kurulum zaten tamamlanmış." };

    const newPasswordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const newRecoveryCode = generateRecoveryCode();
    const newRecoveryHash = bcrypt.hashSync(newRecoveryCode.rawCode, BCRYPT_ROUNDS);
    db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now', '+3 hours'), recovery_hash = ? WHERE id = ?`,
    ).run(newPasswordHash, newRecoveryHash, admin.id);

    return { success: true, message: "Admin hesabı kuruldu.", recoveryCode: newRecoveryCode.displayCode };
  } catch (err) {
    console.error("[auth.service] completeAdminSetup:", err);
    return { success: false, message: "Kurulum tamamlanamadı." };
  }
}

module.exports = {
  login,
  getManagers,
  createManager,
  updateManagerStatus,
  changePassword,
  resetAdminPassword,
  regenerateRecoveryCode,
  getSetupState,
  completeAdminSetup,
};

const bcrypt = require("bcryptjs");
const db = require("../../database/db");

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = "$2a$12$invalidhashfortimingattackprotection";

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
      db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

      return { success: true, user: toSafeUser(user) };
    }

    return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
  } catch {
    return { success: false, message: "Veritabanı hatası. Lütfen hakkında kısmından bilgi alınız." };
  }
}

function getManagers() {
  try {
    const data = db
      .prepare(`SELECT id, username, email, is_active, last_login FROM users WHERE role = 'manager' ORDER BY id ASC`)
      .all();
    return { success: true, data };
  } catch {
    return { success: false, message: "Yönetici listesi alınamadı." };
  }
}

function createManager(data) {
  try {
    if (!data.password || data.password.length < 8)
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };

    if (!data.username || !/^[A-Za-z_][A-Za-z0-9_]{2,}$/.test(data.username))
      return { success: false, message: "Kullanıcı adı en az 3 karakter olmalı ve sadece harf, rakam ile alt çizgi içerebilir." };

    const existing = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(data.username, data.email);
    if (existing) return { success: false, message: "Bu kullanıcı adı veya e-posta zaten kullanımda." };

    const hashedPassword = bcrypt.hashSync(data.password, BCRYPT_ROUNDS);
    db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
      data.username,
      data.email,
      hashedPassword,
      "manager",
    );
    return { success: true, message: "Yönetici hesabı başarıyla oluşturuldu." };
  } catch (err) {
    console.error("[auth] createManager:", err.message);
    if (err.message?.includes("UNIQUE")) return { success: false, message: "Bu kullanıcı adı veya e-posta zaten kullanımda." };
    if (err.message?.includes("CHECK")) return { success: false, message: "Geçersiz kullanıcı adı veya e-posta formatı." };
    return { success: false, message: `Hesap oluşturulamadı: ${err.message}` };
  }
}

function updateManagerStatus(id, isActive) {
  try {
    const result = db.prepare(`UPDATE users SET is_active = ? WHERE id = ? AND role = 'manager'`).run(isActive ? 1 : 0, id);
    if (result.changes === 0) return { success: false, message: "Yönetici bulunamadı." };
    const msg = isActive ? "Yönetici hesabı aktif edildi." : "Yönetici hesabı deaktif edildi.";
    return { success: true, message: msg };
  } catch {
    return { success: false, message: "İşlem gerçekleştirilemedi." };
  }
}

function changePassword(userId, oldPassword, newPassword) {
  try {
    if (!newPassword || newPassword.length < 8)
      return { success: false, message: "Şifre en az 8 karakter olmalıdır." };
    const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: "Kullanıcı bulunamadı." };
    if (!bcrypt.compareSync(oldPassword, user.password_hash))
      return { success: false, message: "Mevcut şifre hatalı." };
    if (bcrypt.compareSync(newPassword, user.password_hash))
      return { success: false, message: "Yeni şifre eski şifreyle aynı olamaz." };

    const newHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    db.prepare(`UPDATE users SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`).run(newHash, userId);
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch {
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

module.exports = { login, getManagers, createManager, updateManagerStatus, changePassword };

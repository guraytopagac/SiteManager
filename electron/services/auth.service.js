const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../../database/db");

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = "$2a$12$invalidhashfortimingattackprotection";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const REMEMBER_TOKEN_DAYS = 30;

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
        `SELECT id, username, email, password_hash, role, last_login, failed_login_attempts, locked_until
         FROM users WHERE username = ? AND is_active = 1`,
      )
      .get(credentials.username);

    if (!user) {
      bcrypt.compareSync(credentials.password, DUMMY_HASH);
      return { success: false, message: "Kullanıcı Adı / Şifre Hatalı!" };
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return { success: false, message: `Hesabınız geçici olarak kilitlendi. ${remaining} dakika sonra tekrar deneyin.` };
    }

    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      db.prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`).run(user.id);
      user.failed_login_attempts = 0;
    }

    if (bcrypt.compareSync(credentials.password, user.password_hash)) {
      const currentLogin = new Date().toISOString();
      db.prepare(
        `UPDATE users SET last_login = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?`,
      ).run(currentLogin, user.id);

      let rememberToken = null;
      if (credentials.rememberMe) {
        rememberToken = generateRememberToken(user.id);
      }

      return { success: true, user: toSafeUser({ ...user, last_login: currentLogin }), rememberToken };
    }

    const newAttempts = (user.failed_login_attempts || 0) + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      db.prepare(`UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`).run(
        newAttempts, lockedUntil, user.id,
      );
      return { success: false, message: `Çok fazla hatalı giriş. Hesabınız ${LOCKOUT_MINUTES} dakika kilitlendi.` };
    }

    db.prepare(`UPDATE users SET failed_login_attempts = ? WHERE id = ?`).run(newAttempts, user.id);
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
    if (!data.password || data.password.length < 6)
      return { success: false, message: "Şifre en az 6 karakter olmalıdır." };

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
    let result;
    if (isActive) {
      result = db.prepare(`UPDATE users SET is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'manager'`).run(id);
    } else {
      result = db.prepare(`UPDATE users SET is_active = 0 WHERE id = ? AND role = 'manager'`).run(id);
    }
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
    const changedAt = new Date().toISOString();
    db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = ?, remember_token = NULL, remember_token_expires = NULL WHERE id = ?`
    ).run(newHash, changedAt, userId);
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch {
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

function generateRememberToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + REMEMBER_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`UPDATE users SET remember_token = ?, remember_token_expires = ? WHERE id = ?`).run(
    token, expires, userId,
  );
  return token;
}

function validateRememberToken(token) {
  try {
    if (!token || typeof token !== "string") return { success: false };
    const user = db
      .prepare(
        `SELECT id, username, email, role, last_login, remember_token_expires, password_changed_at
         FROM users WHERE remember_token = ? AND is_active = 1`,
      )
      .get(token);

    if (!user) return { success: false };
    if (new Date(user.remember_token_expires) <= new Date()) {
      db.prepare(`UPDATE users SET remember_token = NULL, remember_token_expires = NULL WHERE id = ?`).run(user.id);
      return { success: false };
    }
    if (user.password_changed_at) {
      const tokenCreatedApprox = new Date(user.remember_token_expires).getTime() - REMEMBER_TOKEN_DAYS * 24 * 60 * 60 * 1000;
      if (new Date(user.password_changed_at).getTime() > tokenCreatedApprox) {
        db.prepare(`UPDATE users SET remember_token = NULL, remember_token_expires = NULL WHERE id = ?`).run(user.id);
        return { success: false };
      }
    }

    return { success: true, user: toSafeUser(user) };
  } catch {
    return { success: false };
  }
}

function logout(userId) {
  try {
    db.prepare(`UPDATE users SET remember_token = NULL, remember_token_expires = NULL WHERE id = ?`).run(userId);
    return { success: true };
  } catch {
    return { success: false };
  }
}

module.exports = { login, getManagers, createManager, updateManagerStatus, changePassword, validateRememberToken, logout };

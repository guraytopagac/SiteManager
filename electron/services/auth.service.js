const bcrypt = require("bcryptjs");
const db = require("../../database/db");

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
    const user = db
      .prepare(
        `SELECT id, username, email, password_hash, role, last_login FROM users WHERE username = ? AND is_active = 1`,
      )
      .get(credentials.username);

    if (user && bcrypt.compareSync(credentials.password, user.password_hash)) {
      const currentLogin = new Date().toISOString();
      db.prepare(`UPDATE users SET last_login = ? WHERE id = ?`).run(currentLogin, user.id);
      return { success: true, user: toSafeUser({ ...user, last_login: currentLogin }) };
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
    const hashedPassword = bcrypt.hashSync(data.password, 12);
    db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(
      data.username,
      data.email,
      hashedPassword,
      "manager",
    );
    return { success: true, message: "Yönetici hesabı başarıyla oluşturuldu." };
  } catch {
    return { success: false, message: "Bu kullanıcı adı veya e-posta zaten kullanımda." };
  }
}

function updateManagerStatus(id, isActive) {
  try {
    const result = db
      .prepare(`UPDATE users SET is_active = ? WHERE id = ? AND role = 'manager'`)
      .run(isActive ? 1 : 0, id);
    if (result.changes === 0) return { success: false, message: "Yönetici bulunamadı." };
    const msg = isActive ? "Yönetici hesabı aktif edildi." : "Yönetici hesabı deaktif edildi.";
    return { success: true, message: msg };
  } catch {
    return { success: false, message: "İşlem gerçekleştirilemedi." };
  }
}

function changePassword(userId, oldPassword, newPassword) {
  try {
    const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) return { success: false, message: "Kullanıcı bulunamadı." };
    if (!bcrypt.compareSync(oldPassword, user.password_hash))
      return { success: false, message: "Mevcut şifre hatalı." };

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(newHash, userId);
    return { success: true, message: "Şifre başarıyla değiştirildi." };
  } catch {
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

module.exports = { login, getManagers, createManager, updateManagerStatus, changePassword };

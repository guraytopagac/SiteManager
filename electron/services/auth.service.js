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
  return new Promise((resolve) => {
    const query = `SELECT id, username, email, password_hash, role, last_login
                   FROM users
                   WHERE username = ? AND is_active = 1`;

    db.get(query, [credentials.username], (err, user) => {
      if (err)
        return resolve({
          success: false,
          message: "Veritabanı hatası. Lütfen hakkında kısmından bilgi alınız.",
        });

      if (user && bcrypt.compareSync(credentials.password, user.password_hash)) {
        const currentLogin = new Date().toISOString();
        db.run(`UPDATE users SET last_login = ? WHERE id = ?`, [currentLogin, user.id]);

        return resolve({
          success: true,
          user: toSafeUser({ ...user, last_login: currentLogin }),
        });
      }

      resolve({ success: false, message: "Kullanıcı Adı / Şifre Hatalı!" });
    });
  });
}

function getManagers() {
  return new Promise((resolve) => {
    db.all(
      `SELECT id, username, email, is_active, last_login 
       FROM users 
       WHERE role = 'manager' 
       ORDER BY id ASC`,
      [],
      (err, rows) => {
        if (err) return resolve({ success: false, message: "Yönetici listesi alınamadı." });
        resolve({ success: true, data: rows });
      },
    );
  });
}

function createManager(data) {
  return new Promise((resolve) => {
    const query = `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`;
    const hashedPassword = bcrypt.hashSync(data.password, 12);

    db.run(query, [data.username, data.email, hashedPassword, "manager"], function (err) {
      if (err) return resolve({ success: false, message: "Bu kullanıcı adı veya e-posta zaten kullanımda." });
      resolve({ success: true, message: "Yönetici hesabı başarıyla oluşturuldu." });
    });
  });
}

function updateManagerStatus(id, isActive) {
  return new Promise((resolve) => {
    db.run(`UPDATE users SET is_active = ? WHERE id = ? AND role = 'manager'`, [isActive ? 1 : 0, id], function (err) {
      if (err) return resolve({ success: false, message: "İşlem gerçekleştirilemedi." });
      if (this.changes === 0) return resolve({ success: false, message: "Yönetici bulunamadı." });
      const msg = isActive ? "Yönetici hesabı aktif edildi." : "Yönetici hesabı deaktif edildi.";
      resolve({ success: true, message: msg });
    });
  });
}

function changePassword(userId, oldPassword, newPassword) {
  return new Promise((resolve) => {
    db.get(`SELECT password_hash FROM users WHERE id = ?`, [userId], (err, user) => {
      if (err || !user) return resolve({ success: false, message: "Kullanıcı bulunamadı." });
      if (!bcrypt.compareSync(oldPassword, user.password_hash))
        return resolve({ success: false, message: "Mevcut şifre hatalı." });

      const newHash = bcrypt.hashSync(newPassword, 12);
      db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId], function (err2) {
        if (err2) return resolve({ success: false, message: "Şifre güncellenemedi." });
        resolve({ success: true, message: "Şifre başarıyla değiştirildi." });
      });
    });
  });
}

module.exports = { login, getManagers, createManager, updateManagerStatus, changePassword };

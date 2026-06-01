const bcrypt = require('bcryptjs');
const db = require('../../database/db');

function toSafeUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        last_login: user.last_login
    };
}

function login(credentials) {
    return new Promise((resolve) => {
        const query = `
            SELECT id, username, email, password_hash, role, last_login
            FROM users
            WHERE username = ? AND is_active = 1
        `;

        db.get(query, [credentials.username], (err, user) => {
            if (err) return resolve({ success: false, message: "Veritabanı hatası. Lütfen hakkında kısmından bilgi alınız." });

            if (user && bcrypt.compareSync(credentials.password, user.password_hash)) {
                const currentLogin = new Date().toISOString();
                db.run(`UPDATE users SET last_login = ? WHERE id = ?`, [currentLogin, user.id]);

                return resolve({
                    success: true,
                    user: toSafeUser({ ...user, last_login: currentLogin })
                });
            }

            resolve({ success: false, message: "Kullanıcı Adı / Şifre Hatalı!" });
        });
    });
}

function register(userData) {
    return new Promise((resolve) => {
        const query = `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`;
        const hashedPassword = bcrypt.hashSync(userData.password, 12);

        db.run(query, [userData.username, userData.email, hashedPassword, 'manager'], function (err) {
            if (err) return resolve({ success: false, message: "Benzersiz Kullanıcı Adı / Email Gerekli!" });

            resolve({ success: true, message: "Kayıt Başarılı!" });
        });
    });
}

module.exports = { login, register };

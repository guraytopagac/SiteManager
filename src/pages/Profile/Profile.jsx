import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function Profile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      alert.error("Geçersiz Şifre", "Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert.error("Şifre Uyuşmuyor", "Yeni şifre ve tekrarı birbirinden farklı.");
      return;
    }

    setIsSubmitting(true);
    const response = await window.electronAPI.changePassword(currentUser.id, oldPassword, newPassword);
    setIsSubmitting(false);

    if (response.success) {
      await alert.success("Başarılı!", response.message);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      alert.error("Hata", response.message);
    }
  };

  return (
    <div className="profile-container">
      <h2 className="page-title">Profilim</h2>

      {/* Kullanıcı Bilgileri */}
      <div className="profile-card info-card">
        <h3 className="profile-section-title">Hesap Bilgileri</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Kullanıcı Adı</span>
            <span className="info-value">{currentUser.username}</span>
          </div>
          <div className="info-item">
            <span className="info-label">E-posta</span>
            <span className="info-value">{currentUser.email || "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Rol</span>
            <span className="info-value role-badge">{currentUser.role === "admin" ? "Yönetici" : "Sorumlu"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Son Giriş</span>
            <span className="info-value">
              {currentUser.last_login ? new Date(currentUser.last_login).toLocaleString("tr-TR") : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Şifre Değiştir */}
      <div className="profile-card">
        <h3 className="profile-section-title">Şifre Değiştir</h3>
        <form onSubmit={handleChangePassword} className="password-form">
          <div className="input-group">
            <label>Mevcut Şifre</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Mevcut şifrenizi girin"
            />
          </div>
          <div className="password-row">
            <div className="input-group">
              <label>Yeni Şifre</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 6 karakter"
              />
            </div>
            <div className="input-group">
              <label>Yeni Şifre Tekrar</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreyi tekrar girin"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Şifreyi Değiştir"}
            </button>
          </div>
        </form>
      </div>

      <div className="return-link">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Profile;

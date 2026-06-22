import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";
import { formatDateTime } from "../../utils/date";
import { validatePasswordForm } from "../../utils/validation";

function Profile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const oldPasswordRef = useRef(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentUser) return;

    const error = validatePasswordForm(oldPassword, newPassword, confirmPassword);
    if (error) {
      alert.error("Geçersiz Giriş", error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await window.electronAPI.changePassword(currentUser.id, oldPassword, newPassword);
      if (response.success) {
        await alert.success("Başarılı!", response.message);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        oldPasswordRef.current?.focus();
      } else {
        alert.error("Hata", response.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-container">
      <h2 className="page-title">Profilim</h2>

      {/* Kullanıcı Bilgileri */}
      <div className="profile-card">
        <h3 className="profile-section-title">Hesap Bilgileri</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Kullanıcı Adı</span>
            <span className="info-value">{currentUser?.username}</span>
          </div>
          <div className="info-item">
            <span className="info-label">E-posta</span>
            <span className="info-value">{currentUser?.email || "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Rol</span>
            <span className="info-value role-badge">{currentUser?.role === "admin" ? "Yönetici" : "Sorumlu"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Son Giriş</span>
            <span className="info-value">
              {currentUser?.last_login ? formatDateTime(currentUser.last_login) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Şifre Değiştir */}
      <div className="profile-card">
        <h3 className="profile-section-title">Şifre Değiştir</h3>
        <form onSubmit={handleChangePassword} className="password-form">
          <div className="input-group">
            <label htmlFor="old-password">Mevcut Şifre</label>
            <input
              id="old-password"
              ref={oldPasswordRef}
              type="password"
              required
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Mevcut şifrenizi girin"
            />
          </div>
          <div className="password-row">
            <div className="input-group">
              <label htmlFor="new-password">Yeni Şifre</label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
              />
            </div>
            <div className="input-group">
              <label htmlFor="confirm-password">Yeni Şifre Tekrar</label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
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

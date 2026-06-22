import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import { alert } from "../../utils/alert";

function AdminDashboard() {
  const navigate = useNavigate();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchManagers = async () => {
    const response = await window.electronAPI.getManagers();
    if (response.success) {
      setManagers(response.data);
    } else {
      alert.error("Hata", "Yöneticiler yüklenemedi.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const handleCreateManager = async (e) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      alert.warning("Geçersiz Şifre", "Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    const response = await window.electronAPI.createManager(formData);
    setIsSubmitting(false);

    if (response.success) {
      alert.success("Yönetici Oluşturuldu", response.message);
      setFormData({ username: "", email: "", password: "" });
      fetchManagers();
    } else {
      alert.error("Hata", response.message);
    }
  };

  const handleToggleStatus = async (manager) => {
    const willActivate = manager.is_active === 0;
    const confirmText = willActivate
      ? `"${manager.username}" hesabını aktif etmek istiyor musunuz?`
      : `"${manager.username}" hesabını deaktif etmek istiyor musunuz? Bu yönetici giriş yapamaz hale gelir.`;

    const result = await alert.confirm(
      willActivate ? "Hesabı Aktif Et" : "Hesabı Deaktif Et",
      confirmText,
      willActivate ? "Aktif Et" : "Deaktif Et",
      !willActivate,
    );

    if (!result.isConfirmed) return;

    const response = await window.electronAPI.updateManagerStatus(manager.id, willActivate);

    if (response.success) {
      alert.success(response.message, "", 1800);
      fetchManagers();
    } else {
      alert.error("Hata", response.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.dispatchEvent(new Event("user-session-changed"));
    navigate("/", { replace: true });
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">Admin Paneli</h1>
      </div>
      <div className="admin-content">
        <section className="admin-section">
          <h2 className="section-heading">Yöneticiler</h2>
          {loading ? (
            <div className="admin-loading">Yükleniyor...</div>
          ) : managers.length === 0 ? (
            <div className="admin-empty">Henüz yönetici bulunmuyor.</div>
          ) : (
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Kullanıcı Adı</th>
                  <th>E-posta</th>
                  <th>Son Giriş</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr key={manager.id}>
                    <td className="cell-username">{manager.username}</td>
                    <td className="cell-email">{manager.email}</td>
                    <td className="cell-date">
                      {manager.last_login ? new Date(manager.last_login).toLocaleString("tr-TR") : "—"}
                    </td>
                    <td>
                      <span className={`status-pill ${manager.is_active ? "active" : "inactive"}`}>
                        {manager.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn-toggle ${manager.is_active ? "deactivate" : "activate"}`}
                        onClick={() => handleToggleStatus(manager)}
                      >
                        {manager.is_active ? "Deaktif Et" : "Aktif Et"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="admin-section">
          <h2 className="section-heading">Yeni Yönetici Ekle</h2>
          <form className="manager-form" onSubmit={handleCreateManager}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="mgr-username">Kullanıcı Adı</label>
                <input
                  id="mgr-username"
                  type="text"
                  placeholder="kullanici_adi"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mgr-email">E-posta</label>
                <input
                  id="mgr-email"
                  type="email"
                  placeholder="ornek@mavikent.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mgr-password">Şifre</label>
                <input
                  id="mgr-password"
                  type="password"
                  placeholder="En az 6 karakter"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-action btn-create" disabled={isSubmitting}>
              {isSubmitting ? "Oluşturuluyor..." : "Yönetici Oluştur"}
            </button>
          </form>
        </section>
        <button className="btn-action btn-logout" onClick={handleLogout}>
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;

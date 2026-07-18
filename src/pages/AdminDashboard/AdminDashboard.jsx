import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiGrid, FiUsers, FiSettings, FiLogOut, FiEdit2, FiX, FiUser, FiMail, FiLock, FiPower, FiEdit, FiKey } from "react-icons/fi";
import "./AdminDashboard.css";
import { showAlert } from "@/utils/alert";
import { formatDateShort, formatTime } from "@/utils/date";
import { clearCurrentUser } from "@/hooks/useCurrentUser";

function AdminDashboard() {
  const navigate = useNavigate();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (openMenuFor === null) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuFor]);

  const fetchManagers = async () => {
    const response = await window.electronAPI.getManagers();
    if (response.success) {
      setManagers(response.data);
    } else {
      showAlert.error("Hata", "Yöneticiler yüklenemedi.");
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await window.electronAPI.getManagers();
      if (cancelled) return;
      if (response.success) {
        setManagers(response.data);
      } else {
        showAlert.error("Hata", "Yöneticiler yüklenemedi.");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateManager = async (e) => {
    e.preventDefault();

    if (!/^[A-Za-z0-9_]{3,}$/.test(formData.username)) {
      showAlert.warning("Geçersiz Kullanıcı Adı", "Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.");
      return;
    }

    if (formData.password.length < 8) {
      showAlert.warning("Geçersiz Şifre", "Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    const response = await window.electronAPI.createManager(formData);
    setIsSubmitting(false);

    if (response.success) {
      showAlert.success("Yönetici Oluşturuldu", response.message);
      setFormData({ username: "", email: "", password: "" });
      setIsPanelOpen(false);
      fetchManagers();
    } else {
      showAlert.error("Hata", response.message);
    }
  };

  const handleToggleStatus = async (manager) => {
    const willActivate = manager.is_active === 0;
    const confirmText = willActivate
      ? `"${manager.username}" hesabını aktif etmek istiyor musunuz?`
      : `"${manager.username}" hesabını deaktif etmek istiyor musunuz? Bu yönetici giriş yapamaz hale gelir.`;

    const confirmed = willActivate
      ? await showAlert.confirm("Hesabı Aktif Et", confirmText, "Aktif Et")
      : await showAlert.confirmDanger("Hesabı Deaktif Et", confirmText, "Deaktif Et");

    if (!confirmed) return;

    setOpenMenuFor(null);
    const response = await window.electronAPI.updateManagerStatus(manager.id, willActivate);

    if (response.success) {
      showAlert.success(response.message, "");
      fetchManagers();
    } else {
      showAlert.error("Hata", response.message);
    }
  };

  const handleGenerateRecovery = async () => {
    const password = await showAlert.passwordPrompt({
      title: "Kurtarma Kodu Oluştur",
      text: "Kimliğinizi doğrulamak için admin şifrenizi girin. Yeni kod üretildiğinde eski kod geçersiz olur.",
      confirmButtonText: "Oluştur",
    });

    if (!password) return;

    const res = await window.electronAPI.regenerateRecoveryCode(password);
    if (res.success) {
      await showAlert.regeneratedCode(res.recoveryCode);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="admin-layout">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <h1 className="admin-title">Admin Paneli</h1>
          <nav className="admin-nav">
            <div className="admin-nav-item disabled">
              <FiGrid /> Genel Bakış
            </div>
            <div className="admin-nav-item active">
              <FiUsers /> Yöneticiler
            </div>
            <button className="admin-nav-item admin-nav-btn" onClick={handleGenerateRecovery}>
              <FiKey /> Kurtarma Kodu
            </button>
            <div className="admin-nav-item disabled">
              <FiSettings /> Ayarlar
            </div>
          </nav>
          <button className="btn-logout" onClick={handleLogout}>
            <FiLogOut /> Çıkış Yap
          </button>
        </aside>

        <main className="admin-main">
          <div className="admin-main-header">
            <h2 className="admin-main-title">Yöneticiler</h2>
            <button className="btn-add-manager" onClick={() => setIsPanelOpen(true)}>
              Yeni Yönetici Ekle
            </button>
          </div>

          <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-loading">Yükleniyor...</div>
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
                {managers.length === 0 ? (
                  <tr>
                    <td className="cell-empty" colSpan={5}>
                      Henüz yönetici bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  managers.map((manager) => (
                  <tr key={manager.id}>
                    <td className="cell-username">{manager.username}</td>
                    <td className="cell-email">{manager.email}</td>
                    <td className="cell-date">
                      {manager.last_login ? (
                        <>
                          <div>{formatDateShort(manager.last_login)}</div>
                          <div className="cell-date-time">{formatTime(manager.last_login)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${manager.is_active ? "active" : "inactive"}`}>
                        {manager.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td>
                      <div className="cell-actions" ref={openMenuFor === manager.id ? menuRef : null}>
                        <button
                          className="icon-btn"
                          title="İşlemler"
                          onClick={() => setOpenMenuFor(openMenuFor === manager.id ? null : manager.id)}
                        >
                          <FiEdit2 />
                        </button>
                        {openMenuFor === manager.id && (
                          <div className="action-menu">
                            <button
                              className={`action-menu-item ${manager.is_active ? "danger" : "success"}`}
                              onClick={() => handleToggleStatus(manager)}
                            >
                              <FiPower /> {manager.is_active ? "Deaktif Et" : "Aktif Et"}
                            </button>
                            <button className="action-menu-item" disabled title="Yakında">
                              <FiEdit /> Düzenle
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          </div>
        </main>
      </div>

      {isPanelOpen && (
        <>
          <div className="panel-overlay" onClick={() => setIsPanelOpen(false)} />
          <aside className="add-manager-panel">
            <div className="panel-header">
              <h2 className="section-heading">Yeni Yönetici Ekle</h2>
              <button className="icon-btn" onClick={() => setIsPanelOpen(false)}>
                <FiX />
              </button>
            </div>
            <form className="manager-form" onSubmit={handleCreateManager}>
              <div className="form-field">
                <label htmlFor="mgr-username">
                  <FiUser /> Kullanıcı Adı
                </label>
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
                <label htmlFor="mgr-email">
                  <FiMail /> E-posta
                </label>
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
                <label htmlFor="mgr-password">
                  <FiLock /> Şifre
                </label>
                <input
                  id="mgr-password"
                  type="password"
                  placeholder="En az 8 karakter"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-action btn-create" disabled={isSubmitting}>
                {isSubmitting ? "Oluşturuluyor..." : "Yönetici Oluştur"}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;

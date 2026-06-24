import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [stats, setStats] = useState({ cash: 0, collections: 0, delays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await window.electronAPI.getStats(currentUser.id);
    if (data.success) {
      setStats(data.payload);
    } else {
      setError(true);
      alert.error("Veriler Yüklenemedi", data.message || "İstatistikler alınırken bir hata oluştu.");
    }
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    if (!currentUser.id) return;
    fetchStats();
  }, [fetchStats, currentUser.id]);

  const handleLogout = async () => {
    const result = await alert.confirm("Çıkış Yap", "Oturumu kapatmak istiyor musunuz?", "Evet, Çık");
    if (!result.isConfirmed) return;
    sessionStorage.clear();
    window.dispatchEvent(new Event("user-session-changed"));
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">İstatistikler yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="loading">
          İstatistikler yüklenemedi.{" "}
          <button className="button" onClick={fetchStats}>
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="stat-grid">
        <div className="stat-card stat-card-kasa">
          <h3>Kasa</h3>
          <p>{stats.cash.toLocaleString("tr-TR")} ₺</p>
        </div>
        <div className="stat-card stat-card-tahsilat">
          <h3>Tahsilat</h3>
          <p>{stats.collections}%</p>
        </div>
        <div className="stat-card stat-card-gecikme">
          <h3>Gecikme</h3>
          <p>{stats.delays.toLocaleString("tr-TR")} ₺</p>
        </div>
      </div>

      <div className="category-grid">
        <div className="category-group">
          <h2 className="sectionHeader">Daire İşlemleri</h2>
          <div className="action-grid">
            <button className="action-card" onClick={() => navigate("/add-apartment")}>
              <h4>Yeni Daire Ekle</h4>
            </button>
            <button className="action-card" onClick={() => navigate("/apartments")}>
              <h4>Mevcut Daireleri Görüntüle</h4>
            </button>
          </div>
        </div>

        <div className="category-group">
          <h2 className="sectionHeader">Finansal İşlemler</h2>
          <div className="action-grid">
            <button className="action-card" onClick={() => navigate("/add-income")}>
              <h4>Gelir Ekle</h4>
            </button>
            <button className="action-card" onClick={() => navigate("/add-expense")}>
              <h4>Gider Ekle</h4>
            </button>
            <button className="action-card" onClick={() => navigate("/transactions")}>
              <h4>İşlem Geçmişi</h4>
            </button>
          </div>
        </div>

        <div className="category-group">
          <h2 className="sectionHeader">Çeşitli</h2>
          <div className="action-grid">
            <button className="action-card action-card-disabled" disabled title="Yakında">
              <h4>Duyuru Gönder</h4>
            </button>
            <button className="action-card" onClick={() => navigate("/reports")}>
              <h4>Raporlar</h4>
            </button>
            <button className="action-card" onClick={() => navigate("/profile")}>
              <h4>Profilim</h4>
            </button>
          </div>
        </div>
      </div>

      <hr className="section-divider" />

      <div className="return-link">
        <button onClick={handleLogout} className="button button-logout">
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

export default Dashboard;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [stats, setStats] = useState({ cash: 0, collections: 0, delays: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (currentUser.id) {
        const managerId = currentUser.id;
        const data = await window.electronAPI.getStats(managerId);
        if (data.success) {
          setStats(data.payload);
        } else {
          alert.error("Veriler Yüklenemedi", data.message || "İstatistikler alınırken bir hata oluştu.");
        }
      }
      setLoading(false);
    };
    fetchStats();
  }, [currentUser.id]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">İstatistikler yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="stat-grid">
        <div className="stat-card stat-card-kasa">
          <h3>Kasa</h3>
          <p>{stats.cash} ₺</p>
        </div>
        <div className="stat-card stat-card-tahsilat">
          <h3>Tahsilat</h3>
          <p>%{stats.collections}</p>
        </div>
        <div className="stat-card stat-card-gecikme">
          <h3>Gecikme</h3>
          <p>{stats.delays} ₺</p>
        </div>
      </div>

      <div className="category-group">
        <h2 className="sectionHeader">Daire İşlemleri</h2>
        <div className="action-grid">
          <div className="action-card" onClick={() => navigate("/add-apartment")}>
            <h4>Yeni Daire Ekle</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/apartments")}>
            <h4>Mevcut Daireleri Görüntüle</h4>
          </div>
        </div>
      </div>

      <div className="category-group">
        <h2 className="sectionHeader">Finansal İşlemler</h2>
        <div className="action-grid">
          <div className="action-card" onClick={() => navigate("/add-income")}>
            <h4>Gelir Ekle</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/add-expense")}>
            <h4>Gider Ekle</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/transactions")}>
            <h4>İşlem Geçmişi</h4>
          </div>
        </div>
      </div>

      <div className="category-group">
        <h2 className="sectionHeader">Çeşitli</h2>
        <div className="action-grid">
          <div className="action-card" onClick={() => navigate("/send-announcement")}>
            <h4>Duyuru Gönder</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/reports")}>
            <h4>PDF Raporu</h4>
          </div>
        </div>
      </div>

      <hr style={{ margin: "40px 0", opacity: 0.2 }} />

      <div className="return-link">
        <button
          onClick={() => {
            sessionStorage.clear();
            navigate("/", { replace: true });
          }}
          className="button button-logout"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

export default Dashboard;

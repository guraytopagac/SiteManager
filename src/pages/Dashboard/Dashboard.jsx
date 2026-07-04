import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";
import {
  FiDollarSign,
  FiTrendingUp,
  FiClock,
  FiHome,
  FiEye,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiList,
  FiVolume2,
  FiFileText,
  FiUser,
  FiPower,
} from "react-icons/fi";

const ICONS = {
  cash: <FiDollarSign />,
  trend: <FiTrendingUp />,
  clock: <FiClock />,
  buildingAdd: <FiHome />,
  eye: <FiEye />,
  incomeArrow: <FiArrowUpCircle />,
  expenseArrow: <FiArrowDownCircle />,
  list: <FiList />,
  megaphone: <FiVolume2 />,
  document: <FiFileText />,
  user: <FiUser />,
  power: <FiPower />,
};

function Icon({ name }) {
  return <span className="icon">{ICONS[name]}</span>;
}

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [stats, setStats] = useState({ cash: 0, collections: 0, delays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!currentUser.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      const data = await window.electronAPI.getStats(currentUser.id);
      if (cancelled) return;
      if (data.success) {
        setStats(data.payload);
      } else {
        setError(true);
        showAlert.error("Veriler Yüklenemedi", data.message || "İstatistikler alınırken bir hata oluştu.");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser.id, reloadToken]);

  const handleLogout = async () => {
    const result = await showAlert.confirm("Çıkış Yap", "Oturumu kapatmak istiyor musunuz?", "Evet, Çık");
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
          <button className="button" onClick={() => setReloadToken((t) => t + 1)}>
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
          <div className="stat-card-text">
            <h3>Kasa</h3>
            <p>{stats.cash.toLocaleString("tr-TR")} ₺</p>
          </div>
          <div className="stat-icon-badge">
            <Icon name="cash" />
          </div>
        </div>
        <div className="stat-card stat-card-tahsilat">
          <div className="stat-card-text">
            <h3>Tahsilat</h3>
            <p>{stats.collections}%</p>
          </div>
          <div className="stat-icon-badge">
            <Icon name="trend" />
          </div>
        </div>
        <div className="stat-card stat-card-gecikme">
          <div className="stat-card-text">
            <h3>Gecikme</h3>
            <p>{stats.delays.toLocaleString("tr-TR")} ₺</p>
          </div>
          <div className="stat-icon-badge">
            <Icon name="clock" />
          </div>
        </div>
      </div>

      <div className="category-group">
        <h2 className="section-header">Daire İşlemleri</h2>
        <div className="action-grid">
          <button className="action-card action-card-green" onClick={() => navigate("/add-apartment")}>
            <span className="action-icon-badge action-icon-badge-green">
              <Icon name="buildingAdd" />
            </span>
            <span>Yeni Daire Ekle</span>
          </button>
          <button className="action-card action-card-blue" onClick={() => navigate("/apartments")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="eye" />
            </span>
            <span>Mevcut Daireleri Görüntüle</span>
          </button>
        </div>
      </div>

      <div className="category-group">
        <h2 className="section-header">Finansal İşlemler</h2>
        <div className="action-grid">
          <button className="action-card action-card-green" onClick={() => navigate("/add-income")}>
            <span className="action-icon-badge action-icon-badge-green">
              <Icon name="incomeArrow" />
            </span>
            <span>Gelir Ekle</span>
          </button>
          <button className="action-card action-card-red" onClick={() => navigate("/add-expense")}>
            <span className="action-icon-badge action-icon-badge-red">
              <Icon name="expenseArrow" />
            </span>
            <span>Gider Ekle</span>
          </button>
          <button className="action-card action-card-blue" onClick={() => navigate("/transactions")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="list" />
            </span>
            <span>İşlem Geçmişi</span>
          </button>
        </div>
      </div>

      <div className="category-group">
        <h2 className="section-header">Çeşitli</h2>
        <div className="action-grid">
          <button className="action-card action-card-green action-card-disabled" disabled title="Yakında">
            <span className="action-icon-badge action-icon-badge-green">
              <Icon name="megaphone" />
            </span>
            <span>Duyuru Gönder</span>
          </button>
          <button className="action-card action-card-blue" onClick={() => navigate("/reports")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="document" />
            </span>
            <span>Raporlar</span>
          </button>
          <button className="action-card action-card-blue" onClick={() => navigate("/profile")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="user" />
            </span>
            <span>Profilim</span>
          </button>
        </div>
      </div>

      <div className="return-link">
        <button onClick={handleLogout} className="button button-logout">
          <span className="action-icon-badge action-icon-badge-red">
            <Icon name="power" />
          </span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}

export default Dashboard;

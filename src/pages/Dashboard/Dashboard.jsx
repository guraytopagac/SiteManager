import { useState, useEffect, cloneElement } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useCurrentBuilding";
import { showAlert } from "@/utils/alert";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCurrentYear, getCurrentMonth } from "@/utils/date";
import {
  FiDollarSign,
  FiTrendingUp,
  FiClock,
  FiHome,
  FiEye,
  FiUsers,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiList,
  FiFileText,
  FiUser,
} from "react-icons/fi";

const ICONS = {
  cash: <FiDollarSign />,
  trend: <FiTrendingUp />,
  clock: <FiClock />,
  buildingAdd: <FiHome />,
  eye: <FiEye />,
  users: <FiUsers />,
  incomeArrow: <FiArrowUpCircle />,
  expenseArrow: <FiArrowDownCircle />,
  list: <FiList />,
  document: <FiFileText />,
  user: <FiUser />,
};

function Icon({ name }) {
  return <span className="icon">{cloneElement(ICONS[name], { className: "icon-svg" })}</span>;
}

function Dashboard() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [stats, setStats] = useState({ cash: 0, collections: 0, delays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!building?.id) return;
    let isMounted = true;

    (async () => {
      setLoading(true);
      setError(false);
      const res = await window.electronAPI.getStats({ buildingId: building.id });
      if (!isMounted) return;
      if (res.success) {
        setStats(res.data);
      } else {
        setError(true);
        showAlert.error("Veriler Yüklenemedi", res.message || "İstatistikler alınırken bir hata oluştu.");
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [building?.id, reloadToken]);

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
      <div className="dashboard-building-row">
        <h1 className="dashboard-building">{building?.name}</h1>
        <AccountMenu />
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-card-kasa">
          <div className="stat-card-text">
            <h3>Kasa</h3>
            <p>{formatCurrency(stats.cash)}</p>
            <span className="stat-card-period">Tüm zamanlar</span>
          </div>
          <div className="stat-icon-badge">
            <Icon name="cash" />
          </div>
        </div>
        <div className="stat-card stat-card-tahsilat">
          <div className="stat-card-text">
            <h3>Tahsilat</h3>
            <p>{stats.collections}%</p>
            <span className="stat-card-period">{formatMonthYear(getCurrentYear(), getCurrentMonth())}</span>
          </div>
          <div className="stat-icon-badge">
            <Icon name="trend" />
          </div>
        </div>
        <div className="stat-card stat-card-gecikme">
          <div className="stat-card-text">
            <h3>Gecikme</h3>
            <p>{formatCurrency(stats.delays)}</p>
            <span className="stat-card-period">Geçmiş aylar</span>
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
            <span>Daireler ve Aidat</span>
          </button>
          <button className="action-card action-card-blue" onClick={() => navigate("/residents")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="users" />
            </span>
            <span>Sakinleri Yönet</span>
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
          <button className="action-card action-card-blue" onClick={() => navigate("/reports")}>
            <span className="action-icon-badge action-icon-badge-blue">
              <Icon name="document" />
            </span>
            <span>Raporlar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

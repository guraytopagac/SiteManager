import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useSession";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCurrentYear, getCurrentMonth } from "@/utils/date";
import {
  FiAlertTriangle,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiHome,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

function ActionTile({ icon, label, tone, onClick }) {
  const markClass = tone ? `db-action-mark db-action-mark--${tone}` : "db-action-mark";

  return (
    <button className="db-action" type="button" onClick={onClick}>
      <span className={markClass} aria-hidden="true">
        {icon}
      </span>
      <span className="db-action-title">{label}</span>
      <span className="db-action-go" aria-hidden="true">
        <FiChevronRight />
      </span>
    </button>
  );
}

function MetricTile({ className, icon, label, ariaLabel, onOpen, children }) {
  return (
    <button className={className} type="button" onClick={onOpen} aria-label={ariaLabel}>
      <span className="db-metric-label">
        <span className="db-metric-mark" aria-hidden="true">
          {icon}
        </span>
        {label}
        <span className="db-metric-go" aria-hidden="true">
          <FiChevronRight />
        </span>
      </span>
      {children}
    </button>
  );
}

function StatusSkeleton() {
  return (
    <div className="db-metrics">
      {[0, 1, 2].map((index) => (
        <div className="db-metric db-metric--static" key={index}>
          <div className="db-bar db-bar--label" />
          <div className="db-bar db-bar--value" />
        </div>
      ))}
    </div>
  );
}

function StatusError({ onRetry }) {
  return (
    <div className="db-state" role="alert">
      <span className="db-state-mark" aria-hidden="true">
        <FiAlertTriangle />
      </span>
      <span className="db-state-text">
        <span className="db-state-title">Bina durumu okunamadı</span>
        <span className="db-state-body">Aşağıdaki işlemleri kullanmaya devam edebilirsiniz.</span>
      </span>
      <button className="db-retry" type="button" onClick={onRetry}>
        <FiRefreshCw />
        Yeniden Dene
      </button>
    </div>
  );
}

function StatusEmpty({ onAdd }) {
  return (
    <div className="db-state">
      <span className="db-state-mark db-state-mark--accent" aria-hidden="true">
        <FiHome />
      </span>
      <span className="db-state-text">
        <span className="db-state-title">Bu bina henüz boş</span>
        <span className="db-state-body">
          Aidat takibi daire ekledikten sonra başlar. Gelir ve gider kaydını şimdi de girebilirsiniz.
        </span>
      </span>
      <button className="db-retry" type="button" onClick={onAdd}>
        <FiPlus />
        Yeni Daire Ekle
      </button>
    </div>
  );
}

function StatusMetrics({ stats, navigate }) {
  const hasRate = stats.collections !== null;

  return (
    <div className="db-metrics">
      <MetricTile
        className="db-metric db-metric--cash"
        icon={<FiDollarSign />}
        label="Kasa"
        ariaLabel="Kasa, işlem geçmişini aç"
        onOpen={() => navigate("/transactions")}
      >
        <span className="db-metric-value">{formatCurrency(stats.cash)}</span>
      </MetricTile>

      <MetricTile
        className="db-metric"
        icon={<FiTrendingUp />}
        label="Tahsilat"
        ariaLabel="Tahsilat, aidat listesini aç"
        onOpen={() => navigate("/apartments")}
      >
        <span className={hasRate ? "db-metric-value" : "db-metric-value db-metric-value--blank"}>
          {hasRate ? `%${stats.collections}` : "—"}
        </span>
        {hasRate ? (
          <span className="db-meter" aria-hidden="true">
            <span style={{ width: `${stats.collections}%` }} />
          </span>
        ) : (
          <span className="db-metric-meta">Bu ay için tahakkuk yok</span>
        )}
      </MetricTile>

      <MetricTile
        className={stats.delays > 0 ? "db-metric db-metric--delay" : "db-metric"}
        icon={<FiClock />}
        label="Gecikme"
        ariaLabel="Gecikme, aidat listesini aç"
        onOpen={() => navigate("/apartments")}
      >
        <span className="db-metric-value">{formatCurrency(stats.delays)}</span>
      </MetricTile>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [stats, setStats] = useState({ cash: 0, collections: null, delays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const period = formatMonthYear(getCurrentYear(), getCurrentMonth());
  const isEmptyBook = stats.collections === null && stats.cash === 0 && stats.delays === 0;

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
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [building?.id, reloadToken]);

  return (
    <div className="dashboard-container">
      <header className="db-band">
        <div className="db-context">
          <div className="db-identity">
            <span className="db-eyebrow">Seçili Bina</span>
            <h1 className="db-title">{building?.name}</h1>
            <p className="db-subtitle">{period}</p>
          </div>
          <AccountMenu />
        </div>
      </header>

      <section className="db-band" aria-label="Bina durumu">
        {loading && <StatusSkeleton />}
        {!loading && error && <StatusError onRetry={() => setReloadToken((t) => t + 1)} />}
        {!loading && !error && isEmptyBook && <StatusEmpty onAdd={() => navigate("/add-apartment")} />}
        {!loading && !error && !isEmptyBook && <StatusMetrics stats={stats} navigate={navigate} />}
      </section>

      <section className="db-band" aria-label="İşlemler">
        <div className="db-group">
          <div className="db-group-label">
            Daire İşlemleri
            <span className="db-group-hint">Daire ve sakin kayıtları</span>
          </div>
          <div className="db-actions">
            <ActionTile icon={<FiEye />} label="Daireler ve Aidat" onClick={() => navigate("/apartments")} />
            <ActionTile icon={<FiUsers />} label="Sakinleri Yönet" onClick={() => navigate("/residents")} />
            <ActionTile icon={<FiHome />} label="Yeni Daire Ekle" onClick={() => navigate("/add-apartment")} />
          </div>
        </div>

        <div className="db-group">
          <div className="db-group-label">
            Finansal İşlemler
            <span className="db-group-hint">Kasa hareketleri</span>
          </div>
          <div className="db-actions">
            <ActionTile
              icon={<FiArrowUpCircle />}
              label="Gelir Ekle"
              tone="positive"
              onClick={() => navigate("/add-income")}
            />
            <ActionTile
              icon={<FiArrowDownCircle />}
              label="Gider Ekle"
              tone="negative"
              onClick={() => navigate("/add-expense")}
            />
            <ActionTile icon={<FiList />} label="İşlem Geçmişi" onClick={() => navigate("/transactions")} />
          </div>
        </div>

        <div className="db-group">
          <div className="db-group-label">
            Raporlama
            <span className="db-group-hint">Dönem çıktıları</span>
          </div>
          <div className="db-actions">
            <ActionTile icon={<FiFileText />} label="Raporlar" onClick={() => navigate("/reports")} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

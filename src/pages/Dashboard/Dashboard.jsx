import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useIpcData } from "@/hooks/useIpcData";
import { useCurrentBuilding } from "@/hooks/useSession";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCurrentYear, getCurrentMonth } from "@/utils/date";
import {
  FiAlertTriangle,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiGrid,
  FiHome,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiTrendingUp,
  FiUser,
  FiUsers,
} from "react-icons/fi";

function ActionTile({ icon, label, onClick }) {
  return (
    <button className="db-action" type="button" onClick={onClick}>
      <span className="db-action-mark" aria-hidden="true">
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
        ariaLabel="Kasa, gelir ve gider listesini aç"
        onOpen={() => navigate("/transactions")}
      >
        <span className="db-metric-value">{formatCurrency(stats.cash)}</span>
      </MetricTile>

      <MetricTile
        className="db-metric db-metric--rate"
        icon={<FiTrendingUp />}
        label="Tahsilat"
        ariaLabel="Tahsilat, aidat listesini aç"
        onOpen={() => navigate("/dues")}
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
        className={stats.delays > 0 ? "db-metric db-metric--delay" : "db-metric db-metric--neutral"}
        icon={<FiClock />}
        label="Gecikme"
        ariaLabel="Gecikme, aidat listesini aç"
        onOpen={() => navigate("/dues")}
      >
        <span className="db-metric-value">{formatCurrency(stats.delays)}</span>
      </MetricTile>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [res, reload] = useIpcData("getStats", { buildingId: building.id });
  const stats = res.success ? res.data : null;
  const period = formatMonthYear(getCurrentYear(), getCurrentMonth());
  const isEmptyBook = Boolean(stats) && stats.collections === null && stats.cash === 0 && stats.delays === 0;

  return (
    <div className="dashboard-container">
      <header className="db-band">
        <div className="db-context">
          <div className="db-identity">
            <span className="db-eyebrow">Seçili Bina</span>
            <h1 className="db-title" title={building.name}>
              {building.name}
            </h1>
            <p className="db-subtitle">{period}</p>
          </div>
          <AccountMenu />
        </div>
      </header>

      <section className="db-band" aria-label="Bina durumu">
        {!stats && <StatusError onRetry={reload} />}
        {isEmptyBook && <StatusEmpty onAdd={() => navigate("/building-view", { state: { openAdd: true } })} />}
        {stats && !isEmptyBook && <StatusMetrics stats={stats} navigate={navigate} />}
      </section>

      <section className="db-band" aria-label="İşlemler">
        <div className="db-group">
          <div className="db-group-label">Daire İşlemleri</div>
          <div className="db-actions">
            <ActionTile icon={<FiEye />} label="Aidat Takibi" onClick={() => navigate("/dues")} />
            <ActionTile icon={<FiGrid />} label="Bina Görünümü" onClick={() => navigate("/building-view")} />
            <ActionTile icon={<FiUsers />} label="Sakinler" onClick={() => navigate("/residents")} />
          </div>
        </div>

        <div className="db-group">
          <div className="db-group-label">Diğer İşlemler</div>
          <div className="db-actions">
            <ActionTile icon={<FiList />} label="Gelir ve Gider" onClick={() => navigate("/transactions")} />
            <ActionTile icon={<FiFileText />} label="Raporlar" onClick={() => navigate("/reports")} />
            <ActionTile icon={<FiUser />} label="Profilim" onClick={() => navigate("/profile")} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

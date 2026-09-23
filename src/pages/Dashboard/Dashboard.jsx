// The dashboard of the selected building, in three bands: context, status and actions. Each tile is the
// single entry point of its page, so no action is listed twice. The account page has no tile, the account menu
// in the corner already opens it.

import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useIpcData } from "@/hooks/useIpcData";
import { useCurrentBuilding } from "@/hooks/useSession";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCurrentYear, getCurrentMonth } from "@/utils/date";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiBriefcase,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiGrid,
  FiHome,
  FiPieChart,
  FiPlus,
  FiRefreshCw,
  FiTrendingUp,
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

// A button, not a figure, so the dashboard also offers the next move. The affordance is a quiet chevron, and
// nothing is lost if it goes unnoticed, since the named tile below leads to the same page.
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

// Only the status band turns into this block. A screen carrying the navigation must not empty itself over a
// failed read, or the user would be stranded on the dashboard.
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
        onOpen={() => navigate("/cash-book")}
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
  // All three figures are checked: money can be recorded before any apartment exists, and a book with cash
  // in it must keep showing that figure instead of an invitation to add an apartment.
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
          <div className="db-group-label">Daireler</div>
          <div className="db-actions">
            <ActionTile icon={<FiEye />} label="Aidat Takibi" onClick={() => navigate("/dues")} />
            <ActionTile icon={<FiGrid />} label="Bina Görünümü" onClick={() => navigate("/building-view")} />
            <ActionTile icon={<FiUsers />} label="Sakinler" onClick={() => navigate("/residents")} />
            <ActionTile icon={<FiPieChart />} label="Yatırım Aidatı" onClick={() => navigate("/investment")} />
          </div>
        </div>

        <div className="db-group">
          <div className="db-group-label">Kasa ve Personel</div>
          <div className="db-actions">
            <ActionTile icon={<FiBookOpen />} label="Kasa Defteri" onClick={() => navigate("/cash-book")} />
            <ActionTile icon={<FiBriefcase />} label="Personel" onClick={() => navigate("/staff")} />
            <ActionTile icon={<FiFileText />} label="Raporlar" onClick={() => navigate("/reports")} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

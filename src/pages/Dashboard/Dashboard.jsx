// The dashboard of the selected building: a context header, three status cards and two groups of page cards.
// Each card is the entry point of its page, the account page included, so every page is one click away.

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
  FiUser,
  FiUsers,
} from "react-icons/fi";

function ActionTile({ icon, label, description, onClick }) {
  return (
    <button className="db-action" type="button" onClick={onClick}>
      <span className="db-action-mark" aria-hidden="true">
        {icon}
      </span>
      <span className="db-action-title">{label}</span>
      <span className="db-action-desc">{description}</span>
      <span className="db-action-go" aria-hidden="true">
        <FiChevronRight />
      </span>
    </button>
  );
}

function ActionGroup({ title, children }) {
  return (
    <section className="db-group" aria-label={title}>
      <h2 className="db-group-label">{title}</h2>
      <div className="db-actions">{children}</div>
    </section>
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

// The rate is drawn inside the icon square, so this card keeps the same shape as the two beside it.
// pathLength lets the dash length be the percentage itself.
function RateRing({ value }) {
  return (
    <svg className="db-ring" viewBox="0 0 28 28">
      <circle className="db-ring-track" cx="14" cy="14" r="11" />
      <circle className="db-ring-fill" cx="14" cy="14" r="11" pathLength="100" strokeDasharray={`${value} 100`} />
    </svg>
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
        icon={hasRate ? <RateRing value={stats.collections} /> : <FiTrendingUp />}
        label="Tahsilat"
        ariaLabel="Tahsilat, aidat listesini aç"
        onOpen={() => navigate("/dues")}
      >
        <span className={hasRate ? "db-metric-value" : "db-metric-value db-metric-value--blank"}>
          {hasRate ? `%${stats.collections}` : "—"}
        </span>
        {hasRate ? null : <span className="db-metric-meta">Bu ay için tahakkuk yok</span>}
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
      <header className="db-context">
        <div className="db-identity">
          <span className="db-eyebrow">Seçili Bina</span>
          <h1 className="db-title" title={building.name}>
            {building.name}
          </h1>
          <p className="db-subtitle">{period}</p>
        </div>
        <AccountMenu />
      </header>

      <section className="db-status" aria-label="Bina durumu">
        {!stats && <StatusError onRetry={reload} />}
        {isEmptyBook && <StatusEmpty onAdd={() => navigate("/building-view")} />}
        {stats && !isEmptyBook && <StatusMetrics stats={stats} navigate={navigate} />}
      </section>

      <ActionGroup title="Daireler">
        <ActionTile
          icon={<FiEye />}
          label="Aidat Takibi"
          description="Aylık aidat ve tahsilat"
          onClick={() => navigate("/dues")}
        />
        <ActionTile
          icon={<FiGrid />}
          label="Bina Görünümü"
          description="Daireler ve kat planı"
          onClick={() => navigate("/building-view")}
        />
        <ActionTile
          icon={<FiUsers />}
          label="Sakinler"
          description="Malik ve kiracı kayıtları"
          onClick={() => navigate("/residents")}
        />
        <ActionTile
          icon={<FiPieChart />}
          label="Yatırım Aidatı"
          description="Fon, tahakkuk ve bakiye"
          onClick={() => navigate("/investment")}
        />
      </ActionGroup>

      <ActionGroup title="Yönetim">
        <ActionTile
          icon={<FiBookOpen />}
          label="Kasa Defteri"
          description="Gelir, gider ve aktarımlar"
          onClick={() => navigate("/cash-book")}
        />
        <ActionTile
          icon={<FiBriefcase />}
          label="Personel"
          description="Çalışanlar ve tazminat"
          onClick={() => navigate("/staff")}
        />
        <ActionTile
          icon={<FiFileText />}
          label="Raporlar"
          description="PDF ve Excel dökümleri"
          onClick={() => navigate("/reports")}
        />
        <ActionTile
          icon={<FiUser />}
          label="Profilim"
          description="Hesap, şifre ve yedek"
          onClick={() => navigate("/profile")}
        />
      </ActionGroup>
    </div>
  );
}

export default Dashboard;

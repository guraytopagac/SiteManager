// Dues tracking: the monthly list, collection, and the only place the due amount itself can be changed.
// Apartments belong to the building view and resident records to the resident page.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCalendar,
  FiEdit2,
  FiGrid,
  FiHome,
  FiRefreshCw,
  FiSearch,
  FiSkipBack,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import "./Dues.css";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import PaymentModal from "@/components/SharedModals/PaymentModal/PaymentModal";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import SearchBox from "@/components/SearchBox/SearchBox";
import UnitCell from "@/components/UnitCell/UnitCell";
import BulkDueAmountModal from "./DuesModals/BulkDueAmountModal";
import SingleDueAmountModal from "./DuesModals/SingleDueAmountModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useSession, useCurrentBuilding } from "@/hooks/useSession";
import { DUES_STATUS_LABELS, DUES_STATUS_ORDER, EMPTY_RESIDENT_LABEL } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { clampMonth, formatMonthYear, getCurrentMonth, getCurrentYear } from "@/utils/date";
import { searchKey } from "@/utils/searchKey";

const PAGE_SIZE = 5;

// Single owner of the header row and the filler cell span, so a new column cannot leave filler rows short.
const COLUMNS = ["Daire", "Sakin", "Aidat", "Durum", "İşlem"];

function useDues(buildingId, year, month) {
  const [res, loadDues] = useIpcData("getDuesForMonth", { buildingId, year, month });

  return {
    dues: res.success ? res.data : [],
    start: res.success ? res.start : null,
    errorMessage: res.success ? "" : res.message || "Veriler alınamadı.",
    loadDues,
  };
}

// The shell owns the surface, the header and the filler rows, because a fixed height belongs to the shell.
// Filler rows copy the real cell structure and are hidden with visibility, so height and borders still match.
function TableShell({ overlay, spacerCount = 0, children }) {
  const isPlaceholder = Boolean(overlay);
  const spacers = [];

  for (let index = 0; index < spacerCount; index += 1) {
    spacers.push(
      <tr className="du-row-spacer" aria-hidden="true" key={`spacer-${index}`}>
        <td colSpan={COLUMNS.length}>
          <span className="unit-cell">
            <span className="unit-tag">&nbsp;</span>
            <span className="unit-floor">&nbsp;</span>
          </span>
        </td>
      </tr>,
    );
  }

  return (
    <div className={isPlaceholder ? "du-table-surface du-table-placeholder" : "du-table-surface"}>
      <table className="du-table" aria-hidden={isPlaceholder ? "true" : undefined}>
        <thead>
          <tr>
            {COLUMNS.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {spacers}
        </tbody>
      </table>
      {overlay}
    </div>
  );
}

function DuesRow({ due, onCollect }) {
  const paidPercent = due.due_amount > 0 ? Math.min(100, Math.round((due.paid_amount / due.due_amount) * 100)) : 0;
  const isPaid = due.status === "paid";

  return (
    <tr>
      <td>
        <UnitCell apartmentNo={due.apartment_no} floor={due.floor} />
      </td>
      <td
        className={due.resident_name ? "du-resident" : "du-resident du-resident-empty"}
        title={due.resident_name || undefined}
      >
        {due.resident_name || EMPTY_RESIDENT_LABEL}
      </td>
      <td>
        <div className="du-pay-cell">
          <div className="du-pay-amounts">
            <span className="du-pay-paid">{formatCurrency(due.paid_amount)}</span>
            <span className="du-pay-due">/ {formatCurrency(due.due_amount)}</span>
          </div>
          <div className={`du-pay-track du-pay-track--${due.status}`}>
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        </div>
      </td>
      <td>
        <span className={`du-status-chip du-status-chip--${due.status}`}>{DUES_STATUS_LABELS[due.status]}</span>
      </td>
      <td>
        <button
          type="button"
          className={isPaid ? "du-primary-pill du-primary-pill--ghost" : "du-primary-pill"}
          onClick={onCollect}
        >
          {isPaid ? "Detay" : "Tahsil Et"}
        </button>
      </td>
    </tr>
  );
}

// Drawn as an overlay on the shell, so an empty state is as tall as a full page and the layout never jumps.
function ListPlaceholder({ icon, tone, title, body, actionIcon, actionLabel, onAction, role }) {
  return (
    <TableShell
      overlay={
        <div className="du-placeholder-body">
          <div className="du-state" role={role}>
            <span className={tone ? `du-state-mark du-state-mark--${tone}` : "du-state-mark"} aria-hidden="true">
              {icon}
            </span>
            <span className="du-state-text">
              <span className="du-state-title">{title}</span>
              <span className="du-state-body">{body}</span>
            </span>
            {onAction && (
              <button type="button" className="du-state-action" onClick={onAction}>
                {actionIcon}
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      }
      spacerCount={PAGE_SIZE}
    />
  );
}

function CardAction({ icon, label, onClick }) {
  return (
    <button type="button" className="du-card-action" onClick={onClick}>
      <span className="du-card-action-mark" aria-hidden="true">
        {icon}
      </span>
      <span className="du-card-action-title">{label}</span>
    </button>
  );
}

function ActionsCard({ onBulkUpdate, onSingleUpdate }) {
  return (
    <section className="du-card du-actions" aria-label="İlgili işlemler">
      <span className="du-card-title">İlgili İşlemler</span>
      <div className="du-card-actions">
        <CardAction icon={<FiRefreshCw />} label="Toplu Aidat Güncelle" onClick={onBulkUpdate} />
        <CardAction icon={<FiEdit2 />} label="Daire Aidatı Güncelle" onClick={onSingleUpdate} />
      </div>
    </section>
  );
}

function PagesCard({ onNavigate }) {
  return (
    <section className="du-card du-pages" aria-label="İlgili sayfalar">
      <span className="du-card-title">İlgili Sayfalar</span>
      <div className="du-shortcuts">
        <button type="button" className="du-shortcut" onClick={() => onNavigate("/building-view")}>
          <FiGrid aria-hidden="true" />
          Bina Görünümü
        </button>
        <button type="button" className="du-shortcut" onClick={() => onNavigate("/residents")}>
          <FiUsers aria-hidden="true" />
          Sakinler
        </button>
      </div>
    </section>
  );
}

// Reads the whole period and ignores the filters, since it reports the building rather than the list. The
// meter is only hidden when empty, never removed: the rail sets the row height and the card would shrink.
function CollectSummary({ dues, hasError }) {
  const totalDue = dues.reduce((sum, due) => sum + due.due_amount, 0);
  const totalPaid = dues.reduce((sum, due) => sum + due.paid_amount, 0);
  const collectionPercent = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null;
  const isBlank = hasError || collectionPercent === null;
  const amountsText = hasError
    ? "Tahsilat oranı okunamadı"
    : collectionPercent === null
      ? "Bu ay için tahakkuk yok"
      : `${formatCurrency(totalPaid)} / ${formatCurrency(totalDue)}`;

  return (
    <section className="du-card du-collect" aria-label="Tahsilat oranı">
      <div className="du-collect-top">
        <span className="du-collect-label">
          <span className="du-collect-mark" aria-hidden="true">
            <FiTrendingUp />
          </span>
          Tahsilat
        </span>
        <span className={isBlank ? "du-collect-value du-collect-value--blank" : "du-collect-value"}>
          {isBlank ? "—" : `%${collectionPercent}`}
        </span>
      </div>

      <span className={isBlank ? "du-collect-meter du-collect-meter--blank" : "du-collect-meter"} aria-hidden="true">
        <span style={{ width: `${Math.min(collectionPercent ?? 0, 100)}%` }} />
      </span>
      <span className="du-collect-amounts">{amountsText}</span>
    </section>
  );
}

const FILTER_PILLS = [
  { key: "all", label: "Tümü" },
  ...DUES_STATUS_ORDER.map((status) => ({ key: status, label: DUES_STATUS_LABELS[status] })),
];

function DuesControlBar({
  dues,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  statusFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
}) {
  const counts = dues.reduce(
    (acc, due) => {
      acc[due.status] += 1;
      return acc;
    },
    { all: dues.length, paid: 0, partial: 0, unpaid: 0 },
  );

  return (
    <section className="page-band du-control-row" aria-label="Dönem, filtre ve arama">
      {FILTER_PILLS.map((pill) => {
        const isActive = statusFilter === pill.key;
        const modifier = pill.key === "all" ? "" : ` du-pill--${pill.key}`;

        return (
          <button
            key={pill.key}
            type="button"
            className={`du-pill${modifier}${isActive ? " du-pill--active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="du-pill-dot" aria-hidden="true" />}
            {pill.label}
            <span className="du-pill-count">{counts[pill.key]}</span>
          </button>
        );
      })}

      <SearchBox label="Daire no veya sakin ara" value={searchTerm} onChange={onSearchChange} />

      <PeriodSelector
        year={selectedYear}
        month={selectedMonth}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
    </section>
  );
}

function Dues() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showSingleUpdate, setShowSingleUpdate] = useState(false);

  const { dues, start, errorMessage, loadDues } = useDues(building.id, selectedYear, selectedMonth);

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedMonth((month) => clampMonth(year, month));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
  };

  const goToStartPeriod = () => {
    setSelectedYear(start.year);
    setSelectedMonth(start.month);
  };

  const term = searchKey(searchTerm);
  const filteredDues = dues.filter((due) => {
    if (statusFilter !== "all" && due.status !== statusFilter) return false;
    if (!term) return true;
    return searchKey(due.apartment_no).includes(term) || searchKey(due.resident_name).includes(term);
  });

  const {
    pageItems: pagedDues,
    currentPage,
    pageCount,
    setPage,
  } = usePagination(filteredDues, PAGE_SIZE, `${statusFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`);

  // Selection is held as an id and resolved on every render, so the open modal never shows stale figures.
  const selectedDue = dues.find((due) => due.apartment_id === selectedApartmentId) || null;

  const renderList = () => {
    if (errorMessage) {
      return (
        <ListPlaceholder
          icon={<FiAlertTriangle />}
          title="Aidat listesi okunamadı"
          body={errorMessage}
          actionIcon={<FiRefreshCw />}
          actionLabel="Yeniden Dene"
          onAction={loadDues}
          role="alert"
        />
      );
    }

    if (dues.length === 0) {
      // An empty list alone cannot tell an empty building from a period before its apartments, so the service
      // also reports the first month on record and the two cases get their own wording and action.
      if (start) {
        return (
          <ListPlaceholder
            icon={<FiCalendar />}
            tone="muted"
            title="Bu dönemde kayıtlı daire yok"
            body={`Bu binanın aidat kayıtları ${formatMonthYear(start.year, start.month)} ayında başlıyor.`}
            actionIcon={<FiSkipBack />}
            actionLabel="Kayıtların Başladığı Aya Git"
            onAction={goToStartPeriod}
          />
        );
      }

      return (
        <ListPlaceholder
          icon={<FiHome />}
          tone="accent"
          title="Bu binada henüz daire yok"
          body="Aidat takibi ilk daireyi ekledikten sonra başlar."
          actionIcon={<FiGrid />}
          actionLabel="Bina Görünümü"
          onAction={() => navigate("/building-view")}
        />
      );
    }

    if (filteredDues.length === 0) {
      return (
        <ListPlaceholder
          icon={<FiSearch />}
          tone="muted"
          title="Eşleşen daire yok"
          body="Seçili filtre ve arama ile listelenecek daire bulunamadı."
          actionIcon={<FiRefreshCw />}
          actionLabel="Filtreyi Temizle"
          onAction={clearFilters}
        />
      );
    }

    return (
      <TableShell spacerCount={PAGE_SIZE - pagedDues.length}>
        {pagedDues.map((due) => (
          <DuesRow key={due.apartment_id} due={due} onCollect={() => setSelectedApartmentId(due.apartment_id)} />
        ))}
      </TableShell>
    );
  };

  return (
    <div className="dues-container">
      <PageHeader title="Aidat Takibi" />

      <DuesControlBar
        dues={dues}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={handleYearChange}
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <section className="page-band" aria-label="Daire listesi">
        <div className="du-list-split">
          <div className="du-list-main">{renderList()}</div>

          <div className="du-rail">
            <CollectSummary dues={dues} hasError={Boolean(errorMessage)} />
            <ActionsCard
              onBulkUpdate={() => setShowBulkUpdate(true)}
              onSingleUpdate={() => setShowSingleUpdate(true)}
            />
            <PagesCard onNavigate={navigate} />
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </section>

      {selectedDue && (
        <PaymentModal
          due={selectedDue}
          dueType="regular"
          year={selectedYear}
          month={selectedMonth}
          session={session}
          building={building}
          onClose={() => setSelectedApartmentId(null)}
          onPaymentSaved={loadDues}
        />
      )}

      {showBulkUpdate && (
        <BulkDueAmountModal
          building={building}
          onClose={() => setShowBulkUpdate(false)}
          onSaved={() => {
            setShowBulkUpdate(false);
            loadDues();
          }}
        />
      )}

      {showSingleUpdate && (
        <SingleDueAmountModal
          dues={dues}
          building={building}
          onClose={() => setShowSingleUpdate(false)}
          onSaved={() => {
            setShowSingleUpdate(false);
            loadDues();
          }}
        />
      )}
    </div>
  );
}

export default Dues;

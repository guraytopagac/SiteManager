import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiHome,
  FiMoreVertical,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import "./Apartments.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import BulkUpdateModal from "./ApartmentsModals/BulkUpdateModal";
import EditModal from "./ApartmentsModals/EditModal";
import PaymentModal from "./ApartmentsModals/PaymentModal";
import { useSession, useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import { DUES_STATUS_LABELS } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { clampMonth, getCurrentMonth, getCurrentYear } from "@/utils/date";

const PAGE_SIZE = 5;

const COLUMNS = ["Daire", "Sakin", "Aidat", "Durum", "İşlemler"];

function searchKey(value) {
  return String(value ?? "").toLocaleLowerCase("tr");
}

function floorLabel(floor) {
  if (floor == null) return "—";
  return floor === 0 ? "Zemin" : `${floor}. kat`;
}

function UnitCell({ apartmentNo, floor }) {
  return (
    <span className="ap-unit-cell">
      <span className="ap-unit-tag">{apartmentNo}</span>
      <span className="ap-unit-floor">{floorLabel(floor)}</span>
    </span>
  );
}

function useDues(buildingId, year, month) {
  const [dues, setDues] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDues = useCallback(async () => {
    setErrorMessage("");

    try {
      const res = await window.electronAPI.getDuesForMonth({ buildingId, year, month });
      if (res.success) {
        setDues(res.data);
      } else {
        setErrorMessage(res.message || "Veriler alınamadı.");
      }
    } catch (err) {
      console.error("[Apartments] getDuesForMonth:", err);
      setErrorMessage("Beklenmedik bir hata oluştu.");
    }

    setIsFirstLoad(false);
  }, [buildingId, year, month]);

  useEffect(() => {
    (async () => {
      await loadDues();
    })();
  }, [loadDues]);

  return { dues, isFirstLoad, errorMessage, loadDues };
}

async function deleteApartmentFlow(due, buildingId, onDone) {
  const confirmed = await showAlert.confirmDanger(
    "Daireyi Sil",
    { html: `<b>Daire ${due.apartment_no}</b> silinecek. Bu işlem geri alınamaz.` },
    "Vazgeç",
    "Evet, Sil",
  );

  if (!confirmed) return;

  try {
    let res = await window.electronAPI.deleteApartment({ id: due.apartment_id, buildingId });

    if (res.code === "HAS_UNPAID_DUES") {
      const forced = await showAlert.confirmDanger(
        "Ödenmemiş Aidat Var",
        { html: `<b>Daire ${due.apartment_no}</b> için <b>${formatCurrency(res.unpaidTotal)}</b> borç görünüyor.` },
        "Vazgeç",
        "Yine de Sil",
      );

      if (!forced) return;

      res = await window.electronAPI.deleteApartment({ id: due.apartment_id, buildingId, force: true });
    }

    if (res.success) {
      showAlert.toast(res.message);
      onDone();
    } else {
      showAlert.error("Hata", res.message);
    }
  } catch (err) {
    console.error("[Apartments] deleteApartment:", err);
    showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
  }
}

function TableShell({ overlay, spacerCount = 0, children }) {
  const isPlaceholder = Boolean(overlay);
  const spacers = [];

  for (let index = 0; index < spacerCount; index += 1) {
    spacers.push(
      <tr className="ap-row-spacer" aria-hidden="true" key={`spacer-${index}`}>
        <td colSpan={COLUMNS.length}>
          <span className="ap-unit-cell">
            <span className="ap-unit-tag">&nbsp;</span>
            <span className="ap-unit-floor">&nbsp;</span>
          </span>
        </td>
      </tr>,
    );
  }

  return (
    <div className={isPlaceholder ? "ap-table-surface ap-table-placeholder" : "ap-table-surface"}>
      <table className="ap-table" aria-hidden={isPlaceholder ? "true" : undefined}>
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

function DuesRow({ due, onCollect, onEdit, onDelete }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleMouseDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setIsMenuOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setIsMenuOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const paidPercent = due.due_amount > 0 ? Math.min(100, Math.round((due.paid_amount / due.due_amount) * 100)) : 0;
  const isPaid = due.status === "paid";

  return (
    <tr>
      <td>
        <UnitCell apartmentNo={due.apartment_no} floor={due.floor} />
      </td>
      <td
        className={due.resident_name ? "ap-resident" : "ap-resident ap-resident-empty"}
        title={due.resident_name || undefined}
      >
        {due.resident_name || "Sakin yok"}
      </td>
      <td>
        <div className="ap-pay-cell">
          <div className="ap-pay-amounts">
            <span className="ap-pay-paid">{formatCurrency(due.paid_amount)}</span>
            <span className="ap-pay-due">/ {formatCurrency(due.due_amount)}</span>
          </div>
          <div className={`ap-pay-track ap-pay-track--${due.status}`}>
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        </div>
      </td>
      <td>
        <span className={`ap-status-chip ap-status-chip--${due.status}`}>{DUES_STATUS_LABELS[due.status]}</span>
      </td>
      <td>
        <div className="ap-row-actions" ref={wrapperRef}>
          <button
            type="button"
            className={isPaid ? "ap-primary-pill ap-primary-pill--ghost" : "ap-primary-pill"}
            onClick={onCollect}
          >
            {isPaid ? "Detay" : "Tahsil Et"}
          </button>
          <button
            type="button"
            ref={triggerRef}
            className="ap-kebab"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            aria-label={`Daire ${due.apartment_no} işlemleri`}
          >
            <FiMoreVertical />
          </button>
          {isMenuOpen && (
            <div className="ap-kebab-menu">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit();
                }}
              >
                <FiEdit2 />
                Düzenle
              </button>
              <hr />
              <button
                type="button"
                className="ap-kebab-menu-danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete();
                }}
              >
                <FiTrash2 />
                Sil
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  const rows = [];

  for (let index = 0; index < PAGE_SIZE; index += 1) {
    rows.push(
      <tr key={`skeleton-${index}`}>
        <td>
          <span className="ap-unit-cell">
            <span className="ap-unit-tag ap-skeleton">&nbsp;</span>
            <span className="ap-unit-floor ap-skeleton ap-skeleton-floor" />
          </span>
        </td>
        <td>
          <div className="ap-skeleton ap-skeleton-name" />
        </td>
        <td>
          <div className="ap-skeleton ap-skeleton-pay" />
        </td>
        <td>
          <div className="ap-skeleton ap-skeleton-chip" />
        </td>
        <td>
          <div className="ap-skeleton ap-skeleton-action" />
        </td>
      </tr>,
    );
  }

  return rows;
}

function Pager({ currentPage, pageCount, isActive, onChange }) {
  return (
    <div
      className={isActive ? "ap-pagination" : "ap-pagination ap-pagination--idle"}
      aria-hidden={isActive ? undefined : "true"}
    >
      <button
        type="button"
        className="ap-page-btn"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Önceki sayfa"
      >
        <FiChevronLeft />
      </button>
      <span className="ap-page-info">
        Sayfa {currentPage} / {pageCount}
      </span>
      <button
        type="button"
        className="ap-page-btn"
        onClick={() => onChange(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage === pageCount}
        aria-label="Sonraki sayfa"
      >
        <FiChevronRight />
      </button>
    </div>
  );
}

function ListPlaceholder({ icon, tone, title, body, actionIcon, actionLabel, onAction, role }) {
  return (
    <TableShell
      overlay={
        <div className="ap-placeholder-body">
          <div className="ap-state" role={role}>
            <span className={tone ? `ap-state-mark ap-state-mark--${tone}` : "ap-state-mark"} aria-hidden="true">
              {icon}
            </span>
            <span className="ap-state-text">
              <span className="ap-state-title">{title}</span>
              <span className="ap-state-body">{body}</span>
            </span>
            <button type="button" className="ap-state-action" onClick={onAction}>
              {actionIcon}
              {actionLabel}
            </button>
          </div>
        </div>
      }
      spacerCount={PAGE_SIZE}
    />
  );
}

function CardAction({ icon, label, onClick }) {
  return (
    <button type="button" className="ap-card-action" onClick={onClick}>
      <span className="ap-card-action-mark" aria-hidden="true">
        {icon}
      </span>
      <span className="ap-card-action-title">{label}</span>
    </button>
  );
}

function CollectSummary({ dues, isFirstLoad, hasError }) {
  const totalDue = dues.reduce((sum, due) => sum + due.due_amount, 0);
  const totalPaid = dues.reduce((sum, due) => sum + due.paid_amount, 0);
  const collectionPercent = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null;

  return (
    <section className="ap-card ap-collect" aria-label="Tahsilat oranı">
      <div className="ap-collect-top">
        <span className="ap-collect-label">
          <span className="ap-collect-mark" aria-hidden="true">
            <FiTrendingUp />
          </span>
          Tahsilat
        </span>
        {isFirstLoad ? (
          <span className="ap-collect-value ap-skeleton" aria-hidden="true" />
        ) : (
          <span
            className={
              collectionPercent === null || hasError ? "ap-collect-value ap-collect-value--blank" : "ap-collect-value"
            }
          >
            {collectionPercent === null || hasError ? "—" : `%${collectionPercent}`}
          </span>
        )}
      </div>

      {isFirstLoad && <span className="ap-collect-meter ap-skeleton" aria-hidden="true" />}
      {!isFirstLoad && !hasError && collectionPercent !== null && (
        <span className="ap-collect-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(collectionPercent, 100)}%` }} />
        </span>
      )}

      {isFirstLoad ? (
        <span className="ap-collect-amounts ap-skeleton" aria-hidden="true" />
      ) : (
        <span className="ap-collect-amounts">
          {hasError
            ? "Tahsilat oranı okunamadı"
            : collectionPercent === null
              ? "Bu ay için tahakkuk yok"
              : `${formatCurrency(totalPaid)} / ${formatCurrency(totalDue)}`}
        </span>
      )}
    </section>
  );
}

const FILTER_PILLS = [
  { key: "all", label: "Tümü" },
  { key: "paid", label: DUES_STATUS_LABELS.paid },
  { key: "partial", label: DUES_STATUS_LABELS.partial },
  { key: "unpaid", label: DUES_STATUS_LABELS.unpaid },
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
  isFirstLoad,
}) {
  const counts = dues.reduce(
    (acc, due) => {
      acc[due.status] += 1;
      return acc;
    },
    { all: dues.length, paid: 0, partial: 0, unpaid: 0 },
  );

  return (
    <section className="ap-band ap-control-row" aria-label="Dönem, filtre ve arama">
      {FILTER_PILLS.map((pill) => {
        const isActive = statusFilter === pill.key;
        const modifier = pill.key === "all" ? "" : ` ap-pill--${pill.key}`;

        return (
          <button
            key={pill.key}
            type="button"
            className={`ap-pill${modifier}${isActive ? " ap-pill--active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            disabled={isFirstLoad}
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="ap-pill-dot" aria-hidden="true" />}
            {pill.label}
            {!isFirstLoad && <span className="ap-pill-count">{counts[pill.key]}</span>}
          </button>
        );
      })}

      <label className="ap-search">
        <FiSearch size={18} aria-hidden="true" />
        <input
          type="text"
          aria-label="Daire no veya sakin ara"
          placeholder="Daire no veya sakin ara"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isFirstLoad}
        />
      </label>

      <PeriodSelector
        year={selectedYear}
        month={selectedMonth}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
    </section>
  );
}

function Apartments() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageKey, setPageKey] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [editingApartment, setEditingApartment] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const { dues, isFirstLoad, errorMessage, loadDues } = useDues(building.id, selectedYear, selectedMonth);

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedMonth((month) => clampMonth(year, month));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
  };

  const term = searchKey(searchTerm).trim();
  const filteredDues = dues.filter((due) => {
    if (statusFilter !== "all" && due.status !== statusFilter) return false;
    if (!term) return true;
    return searchKey(due.apartment_no).includes(term) || searchKey(due.resident_name).includes(term);
  });

  const nextPageKey = `${statusFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`;
  if (pageKey !== nextPageKey) {
    setPageKey(nextPageKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filteredDues.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedDues = filteredDues.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedDue = dues.find((due) => due.apartment_id === selectedApartmentId) || null;

  const renderList = () => {
    if (isFirstLoad) {
      return (
        <TableShell>
          <SkeletonRows />
        </TableShell>
      );
    }

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
      return (
        <ListPlaceholder
          icon={<FiHome />}
          tone="accent"
          title="Bu binada henüz daire yok"
          body="Aidat takibi ilk daireyi ekledikten sonra başlar."
          actionIcon={<FiPlus />}
          actionLabel="Yeni Daire Ekle"
          onAction={() => navigate("/add-apartment")}
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
          <DuesRow
            key={due.apartment_id}
            due={due}
            onCollect={() => setSelectedApartmentId(due.apartment_id)}
            onEdit={() => setEditingApartment(due)}
            onDelete={() => deleteApartmentFlow(due, building.id, loadDues)}
          />
        ))}
      </TableShell>
    );
  };

  const isPagerActive = !isFirstLoad && !errorMessage && filteredDues.length > 0 && pageCount > 1;

  return (
    <div className="apartments-container">
      <header className="ap-band ap-context">
        <div className="ap-context-top">
          <button type="button" className="ap-back" onClick={() => navigate("/dashboard")}>
            <FiArrowLeft />
            Panoya Dön
          </button>
          <AccountMenu />
        </div>

        <div className="ap-context-main">
          <h1 className="ap-title">Daireler ve Aidat</h1>
          <span className="ap-building" title={building.name}>
            {building.name}
          </span>
        </div>
      </header>

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
        isFirstLoad={isFirstLoad}
      />

      <section className="ap-band" aria-label="Daire listesi">
        <div className="ap-list-split">
          <div className="ap-list-main">{renderList()}</div>

          <div className="ap-rail">
            <CollectSummary dues={dues} isFirstLoad={isFirstLoad} hasError={Boolean(errorMessage)} />

            <aside className="ap-card" aria-label="İlgili işlemler">
              <span className="ap-card-eyebrow">İlgili İşlemler</span>
              <div className="ap-card-actions">
                <CardAction icon={<FiHome />} label="Yeni Daire Ekle" onClick={() => navigate("/add-apartment")} />
                <CardAction icon={<FiUsers />} label="Sakinleri Yönet" onClick={() => navigate("/residents")} />
                <CardAction
                  icon={<FiRefreshCw />}
                  label="Toplu Aidat Güncelle"
                  onClick={() => setShowBulkUpdate(true)}
                />
              </div>
            </aside>
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} isActive={isPagerActive} onChange={setPage} />
        </div>
      </section>

      {selectedDue && (
        <PaymentModal
          due={selectedDue}
          year={selectedYear}
          month={selectedMonth}
          session={session}
          building={building}
          onClose={() => setSelectedApartmentId(null)}
          onPaymentSaved={loadDues}
        />
      )}

      {editingApartment && (
        <EditModal
          apartment={editingApartment}
          building={building}
          onClose={() => setEditingApartment(null)}
          onSaved={() => {
            setEditingApartment(null);
            loadDues();
          }}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateModal
          building={building}
          onClose={() => setShowBulkUpdate(false)}
          onSaved={() => {
            setShowBulkUpdate(false);
            loadDues();
          }}
        />
      )}
    </div>
  );
}

export default Apartments;

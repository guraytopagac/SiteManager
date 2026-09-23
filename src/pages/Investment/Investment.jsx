// Investment dues: the monthly fund contribution charged to the owners, its collection and the fund
// balance it builds up. The charge is owed by the owner, so this list names the owner rather than whoever
// lives there. The monthly dues belong to the dues page and the fund's expenses to the ledger.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiCalendar,
  FiHome,
  FiPieChart,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiSkipBack,
  FiTrendingUp,
} from "react-icons/fi";
import "./Investment.css";
import { showDialog } from "@/components/Dialog/dialogStore";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import PaymentModal from "@/components/SharedModals/PaymentModal/PaymentModal";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import SearchBox from "@/components/SearchBox/SearchBox";
import UnitCell from "@/components/UnitCell/UnitCell";
import FundSettingsModal from "./InvestmentModals/FundSettingsModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import {
  DUES_STATUS_LABELS,
  DUES_STATUS_ORDER,
  EMPTY_OWNER_LABEL,
  MAX_DUE_AMOUNT,
  MAX_OPENING_BALANCE,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { clampMonth, formatMonthYear, getCurrentMonth, getCurrentYear } from "@/utils/date";
import { searchKey } from "@/utils/searchKey";

const PAGE_SIZE = 5;

// Single owner of the header row and the filler cell span, so a new column cannot leave filler rows short.
const COLUMNS = ["Daire", "Malik", "Tutar", "Durum", "İşlem"];

function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

function useInvestment(buildingId, year, month) {
  const [res, reload] = useIpcData("getInvestmentOverview", { buildingId, year, month });

  return {
    fund: res.success ? res.fund : null,
    charges: res.success ? res.data : [],
    totals: res.success ? res.totals : null,
    start: res.success ? res.start : null,
    errorMessage: res.success ? "" : res.message || "Veriler alınamadı.",
    reload,
  };
}

// The shell owns the surface, the header and the filler rows, because a fixed height belongs to the shell.
// Filler rows copy the real cell structure and are hidden with visibility, so height and borders still match.
function TableShell({ overlay, spacerCount = 0, children }) {
  const isPlaceholder = Boolean(overlay);
  const spacers = [];

  for (let index = 0; index < spacerCount; index += 1) {
    spacers.push(
      <tr className="iv-row-spacer" aria-hidden="true" key={`spacer-${index}`}>
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
    <div className={isPlaceholder ? "iv-table-surface iv-table-placeholder" : "iv-table-surface"}>
      <table className="iv-table" aria-hidden={isPlaceholder ? "true" : undefined}>
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

function ChargeRow({ charge, onCollect }) {
  const paidPercent =
    charge.due_amount > 0 ? Math.min(100, Math.round((charge.paid_amount / charge.due_amount) * 100)) : 0;
  const isPaid = charge.status === "paid";

  return (
    <tr>
      <td>
        <UnitCell apartmentNo={charge.apartment_no} floor={charge.floor} />
      </td>
      <td className={charge.owner_name ? "iv-owner" : "iv-owner iv-owner-empty"} title={charge.owner_name || undefined}>
        {charge.owner_name || EMPTY_OWNER_LABEL}
      </td>
      <td>
        <div className="iv-pay-cell">
          <div className="iv-pay-amounts">
            <span className="iv-pay-paid">{formatCurrency(charge.paid_amount)}</span>
            <span className="iv-pay-due">/ {formatCurrency(charge.due_amount)}</span>
          </div>
          <div className={`iv-pay-track iv-pay-track--${charge.status}`}>
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        </div>
      </td>
      <td>
        <span className={`iv-status-chip iv-status-chip--${charge.status}`}>{DUES_STATUS_LABELS[charge.status]}</span>
      </td>
      <td>
        <button
          type="button"
          className={isPaid ? "iv-primary-pill iv-primary-pill--ghost" : "iv-primary-pill"}
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
        <div className="iv-placeholder-body">
          <div className="iv-state" role={role}>
            <span className={tone ? `iv-state-mark iv-state-mark--${tone}` : "iv-state-mark"} aria-hidden="true">
              {icon}
            </span>
            <span className="iv-state-text">
              <span className="iv-state-title">{title}</span>
              <span className="iv-state-body">{body}</span>
            </span>
            {onAction && (
              <button type="button" className="iv-state-action" onClick={onAction}>
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
    <button type="button" className="iv-card-action" onClick={onClick}>
      <span className="iv-card-action-mark" aria-hidden="true">
        {icon}
      </span>
      <span className="iv-card-action-title">{label}</span>
    </button>
  );
}

// The fund in one card: the balance on top, the three figures it is made of, and the way into the settings.
// It carries an action, unlike the collection card, the same way the ledger's main cash card does.
function FundCard({ fund, totals, hasError, onSettings }) {
  const isBlank = hasError || !totals;
  const balanceTone = isBlank || totals.balance === 0 ? "" : totals.balance < 0 ? " iv-fund-value--negative" : "";
  const rows = [
    { label: "Açılış", value: totals?.opening },
    { label: "Toplanan", value: totals?.collected },
    { label: "Harcanan", value: totals?.spent },
  ];

  return (
    <section className="iv-card iv-fund" aria-label="Yatırım fonu">
      <div className="iv-fund-top">
        <span className="iv-fund-label">
          <span className="iv-fund-mark" aria-hidden="true">
            <FiPieChart />
          </span>
          Fon Bakiyesi
        </span>
        <span className={`iv-fund-value${balanceTone}`}>{isBlank ? "—" : formatCurrency(totals.balance)}</span>
      </div>

      <div className="iv-fund-rows">
        {rows.map((row) => (
          <div key={row.label} className="iv-fund-row">
            <span>{row.label}</span>
            <b>{isBlank ? "—" : formatCurrency(row.value)}</b>
          </div>
        ))}
      </div>

      {fund && fund.is_collecting === 0 && <span className="iv-fund-note">Toplama durduruldu</span>}

      <CardAction icon={<FiSettings />} label="Fon Ayarları" onClick={onSettings} />
    </section>
  );
}

// Reads the whole period and ignores the filters, since it reports the building rather than the list. The
// meter is only hidden when empty, never removed: the rail sets the row height and the card would shrink.
function CollectSummary({ charges, hasError }) {
  const totalDue = charges.reduce((sum, charge) => sum + charge.due_amount, 0);
  const totalPaid = charges.reduce((sum, charge) => sum + charge.paid_amount, 0);
  const collectionPercent = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null;
  const isBlank = hasError || collectionPercent === null;
  const amountsText = hasError
    ? "Tahsilat oranı okunamadı"
    : collectionPercent === null
      ? "Bu ay için tahakkuk yok"
      : `${formatCurrency(totalPaid)} / ${formatCurrency(totalDue)}`;

  return (
    <section className="iv-card iv-collect" aria-label="Tahsilat oranı">
      <div className="iv-collect-top">
        <span className="iv-collect-label">
          <span className="iv-collect-mark" aria-hidden="true">
            <FiTrendingUp />
          </span>
          Tahsilat
        </span>
        <span className={isBlank ? "iv-collect-value iv-collect-value--blank" : "iv-collect-value"}>
          {isBlank ? "—" : `%${collectionPercent}`}
        </span>
      </div>

      <span className={isBlank ? "iv-collect-meter iv-collect-meter--blank" : "iv-collect-meter"} aria-hidden="true">
        <span style={{ width: `${Math.min(collectionPercent ?? 0, 100)}%` }} />
      </span>
      <span className="iv-collect-amounts">{amountsText}</span>
    </section>
  );
}

function PagesCard({ onNavigate }) {
  return (
    <section className="iv-card iv-pages" aria-label="İlgili sayfalar">
      <span className="iv-card-title">İlgili Sayfalar</span>
      <div className="iv-shortcuts">
        <button type="button" className="iv-shortcut" onClick={() => onNavigate("/dues")}>
          <FiCalendar aria-hidden="true" />
          Aidat Takibi
        </button>
        <button type="button" className="iv-shortcut" onClick={() => onNavigate("/cash-book")}>
          <FiBookOpen aria-hidden="true" />
          Kasa Defteri
        </button>
      </div>
    </section>
  );
}

const FILTER_PILLS = [
  { key: "all", label: "Tümü" },
  ...DUES_STATUS_ORDER.map((status) => ({ key: status, label: DUES_STATUS_LABELS[status] })),
];

function InvestmentControlBar({
  charges,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  statusFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
}) {
  const counts = charges.reduce(
    (acc, charge) => {
      acc[charge.status] += 1;
      return acc;
    },
    { all: charges.length, paid: 0, partial: 0, unpaid: 0 },
  );

  return (
    <section className="page-band iv-control-row" aria-label="Dönem, filtre ve arama">
      {FILTER_PILLS.map((pill) => {
        const isActive = statusFilter === pill.key;
        const modifier = pill.key === "all" ? "" : ` iv-pill--${pill.key}`;

        return (
          <button
            key={pill.key}
            type="button"
            className={`iv-pill${modifier}${isActive ? " iv-pill--active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="iv-pill-dot" aria-hidden="true" />}
            {pill.label}
            <span className="iv-pill-count">{counts[pill.key]}</span>
          </button>
        );
      })}

      <SearchBox label="Daire no veya malik ara" value={searchTerm} onChange={onSearchChange} />

      <PeriodSelector
        year={selectedYear}
        month={selectedMonth}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
    </section>
  );
}

// Shown in place of the whole page until the fund exists, the same way the staff page asks for its fund.
function FundStartForm({ building, onStarted }) {
  const [monthlyInput, setMonthlyInput] = useState("");
  const [openingInput, setOpeningInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const monthlyAmount = roundToCents(monthlyInput);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > MAX_DUE_AMOUNT) {
      showDialog.warning("Geçersiz Tutar", "Aylık tutar 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
      return;
    }

    const openingBalance = openingInput === "" ? 0 : roundToCents(openingInput);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      showDialog.warning("Geçersiz Tutar", "Açılış bakiyesi 0 ya da daha büyük olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.setupInvestmentFund({
        buildingId: building.id,
        monthlyAmount,
        openingBalance,
      });
      if (res.success) {
        showDialog.toast(res.message);
        onStarted();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Investment] setupInvestmentFund:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  return (
    <section className="page-band iv-setup-band" aria-label="Yatırım aidatını başlat">
      <form className="iv-setup" onSubmit={handleSubmit}>
        <div className="iv-setup-intro">
          <span className="iv-setup-mark" aria-hidden="true">
            <FiPieChart />
          </span>
          <div>
            <h2 className="iv-setup-title">Yatırım Aidatını Başlat</h2>
            <p className="iv-setup-body">
              Yatırım aidatı, binanın değerini koruyan büyük işler için her daireden aylık aidata ek olarak toplanan
              paradır ve dairenin malikine yazılır. Tahakkuk bu aydan başlar, daha önce biriken para varsa açılış
              bakiyesi olarak girilir.
            </p>
          </div>
        </div>

        <div className="iv-setup-grid">
          <div className="iv-field">
            <label htmlFor="iv-monthly">Daire Başına Aylık Tutar (₺)</label>
            <input
              id="iv-monthly"
              type="number"
              step="0.01"
              min="0.01"
              max={MAX_DUE_AMOUNT}
              placeholder="Örn. 500"
              value={monthlyInput}
              onChange={(e) => setMonthlyInput(e.target.value)}
              required
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-opening">Açılış Bakiyesi (₺)</label>
            <input
              id="iv-opening"
              type="number"
              step="0.01"
              min="0"
              max={MAX_OPENING_BALANCE}
              placeholder="Örn. 25000"
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
            />
          </div>

          <button type="submit" className="iv-setup-submit" disabled={isSubmitting}>
            {isSubmitting ? "Başlatılıyor..." : "Başlat"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Investment() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const { fund, charges, totals, start, errorMessage, reload } = useInvestment(
    building.id,
    selectedYear,
    selectedMonth,
  );

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
  const filteredCharges = charges.filter((charge) => {
    if (statusFilter !== "all" && charge.status !== statusFilter) return false;
    if (!term) return true;
    return searchKey(charge.apartment_no).includes(term) || searchKey(charge.owner_name).includes(term);
  });

  const {
    pageItems: pagedCharges,
    currentPage,
    pageCount,
    setPage,
  } = usePagination(filteredCharges, PAGE_SIZE, `${statusFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`);

  // Selection is held as an id and resolved on every render, so the open modal never shows stale figures.
  const selectedCharge = charges.find((charge) => charge.apartment_id === selectedApartmentId) || null;

  const renderList = () => {
    if (errorMessage) {
      return (
        <ListPlaceholder
          icon={<FiAlertTriangle />}
          title="Yatırım aidatı listesi okunamadı"
          body={errorMessage}
          actionIcon={<FiRefreshCw />}
          actionLabel="Yeniden Dene"
          onAction={reload}
          role="alert"
        />
      );
    }

    if (charges.length === 0) {
      // An empty list alone cannot tell a building with no apartments from a month the fund did not collect,
      // so the service also reports the first month on record and the two cases get their own wording.
      if (start) {
        return (
          <ListPlaceholder
            icon={<FiCalendar />}
            tone="muted"
            title="Bu dönemde yatırım aidatı yok"
            body={`Bu binanın yatırım aidatı kayıtları ${formatMonthYear(start.year, start.month)} ayında başlıyor.`}
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
          body="Yatırım aidatı ilk daireyi ekledikten sonra tahakkuk etmeye başlar."
          actionIcon={<FiHome />}
          actionLabel="Bina Görünümü"
          onAction={() => navigate("/building-view")}
        />
      );
    }

    if (filteredCharges.length === 0) {
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
      <TableShell spacerCount={PAGE_SIZE - pagedCharges.length}>
        {pagedCharges.map((charge) => (
          <ChargeRow
            key={charge.apartment_id}
            charge={charge}
            onCollect={() => setSelectedApartmentId(charge.apartment_id)}
          />
        ))}
      </TableShell>
    );
  };

  // The fund has to exist before there is anything to list, so the start form replaces the whole page.
  if (!fund && !errorMessage) {
    return (
      <div className="investment-container">
        <PageHeader title="Yatırım Aidatı" />
        <FundStartForm building={building} onStarted={reload} />
      </div>
    );
  }

  return (
    <div className="investment-container">
      <PageHeader title="Yatırım Aidatı" />

      <InvestmentControlBar
        charges={charges}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={handleYearChange}
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <section className="page-band" aria-label="Yatırım aidatı listesi">
        <div className="iv-list-split">
          <div className="iv-list-main">{renderList()}</div>

          <div className="iv-rail">
            <FundCard
              fund={fund}
              totals={totals}
              hasError={Boolean(errorMessage)}
              onSettings={() => setShowSettings(true)}
            />
            <CollectSummary charges={charges} hasError={Boolean(errorMessage)} />
            <PagesCard onNavigate={navigate} />
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </section>

      {selectedCharge && (
        <PaymentModal
          due={selectedCharge}
          dueType="investment"
          year={selectedYear}
          month={selectedMonth}
          session={session}
          building={building}
          onClose={() => setSelectedApartmentId(null)}
          onPaymentSaved={reload}
        />
      )}

      {showSettings && (
        <FundSettingsModal
          fund={fund}
          building={building}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default Investment;

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiCalendar,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiSkipBack,
  FiTrendingUp,
} from "react-icons/fi";
import "./Transactions.css";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import SearchBox from "@/components/SearchBox/SearchBox";
import TransactionModal from "./TransactionsModals/TransactionModal";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import { TRANSACTION_CATEGORY_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatSignedCurrency } from "@/utils/currency";
import { showDialog } from "@/utils/dialog";
import { clampMonth, formatDate, formatMonthYear, getCurrentMonth, getCurrentYear, toPeriod } from "@/utils/date";
import { searchKey } from "@/utils/searchKey";

const PAGE_SIZE = 8;

const COLUMNS = ["Tarih", "Kategori", "Açıklama", "Tutar", "İşlem"];

const FILTER_PILLS = [
  { key: "all", label: "Tümü" },
  { key: "income", label: "Gelirler" },
  { key: "expense", label: "Giderler" },
];

const EMPTY_TOTALS = { totalIncome: 0, totalExpense: 0, net: 0 };

function useTransactions(buildingId, year, month) {
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [start, setStart] = useState(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTransactions = useCallback(async () => {
    setErrorMessage("");

    try {
      const res = await window.electronAPI.getTransactions({ buildingId, period: { year, month } });
      if (res.success) {
        setTransactions(res.data);
        setTotals(res.totals);
        setStart(res.start);
      } else {
        setErrorMessage(res.message || "İşlem listesi alınamadı.");
      }
    } catch (err) {
      console.error("[Transactions] getTransactions:", err);
      setErrorMessage(UNEXPECTED_ERROR_MESSAGE);
    }

    setIsFirstLoad(false);
  }, [buildingId, year, month]);

  useEffect(() => {
    (async () => {
      await loadTransactions();
    })();
  }, [loadTransactions]);

  return { transactions, totals, start, isFirstLoad, errorMessage, loadTransactions };
}

function TableShell({ overlay, spacerCount = 0, children }) {
  const isPlaceholder = Boolean(overlay);
  const spacers = [];

  for (let index = 0; index < spacerCount; index += 1) {
    spacers.push(
      <tr className="tx-row-spacer" aria-hidden="true" key={`spacer-${index}`}>
        <td colSpan={COLUMNS.length}>
          <span className="tx-slot">&nbsp;</span>
        </td>
      </tr>,
    );
  }

  return (
    <div className={isPlaceholder ? "tx-table-surface tx-table-placeholder" : "tx-table-surface"}>
      <table className="tx-table" aria-hidden={isPlaceholder ? "true" : undefined}>
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

function CancelCell({ transaction, onCancel }) {
  if (transaction.is_cancelled) {
    return (
      <button
        type="button"
        className="tx-detail-btn"
        onClick={() =>
          showDialog.cancelledRecord({
            reason: transaction.cancel_reason,
            date: formatDate(transaction.cancelled_at),
          })
        }
        title="İptal nedenini görüntüle"
      >
        Detay
      </button>
    );
  }

  if (transaction.category === "dues") {
    return (
      <span className="tx-slot tx-locked" title="Aidat geliri yalnızca ödemesi iptal edilerek geri alınır">
        —
      </span>
    );
  }

  return (
    <button type="button" className="tx-cancel-btn" onClick={onCancel}>
      İptal Et
    </button>
  );
}

function TransactionRow({ transaction, onCancel }) {
  const signedAmount = transaction.type === "income" ? transaction.amount : -transaction.amount;

  return (
    <tr className={transaction.is_cancelled ? "tx-row--cancelled" : undefined}>
      <td className="tx-date">{formatDate(transaction.date)}</td>
      <td className="tx-category">{TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category}</td>
      <td className="tx-desc" title={transaction.description}>
        {transaction.is_cancelled && <span className="tx-cancelled-tag">İptal edildi ·</span>}
        {transaction.description}
      </td>
      <td className={`tx-amount tx-amount--${transaction.type}`}>{formatSignedCurrency(signedAmount)}</td>
      <td>
        <CancelCell transaction={transaction} onCancel={onCancel} />
      </td>
    </tr>
  );
}

function SkeletonRows() {
  const skeletons = [];

  for (let index = 0; index < PAGE_SIZE; index += 1) {
    skeletons.push(
      <tr key={`skeleton-${index}`}>
        <td>
          <div className="tx-skeleton tx-skeleton-date" />
        </td>
        <td>
          <div className="tx-skeleton tx-skeleton-category" />
        </td>
        <td>
          <div className="tx-skeleton tx-skeleton-desc" />
        </td>
        <td>
          <div className="tx-skeleton tx-skeleton-amount" />
        </td>
        <td>
          <div className="tx-skeleton tx-skeleton-action" />
        </td>
      </tr>,
    );
  }

  return skeletons;
}

function ListPlaceholder({ icon, tone, title, body, actionIcon, actionLabel, onAction, role }) {
  return (
    <TableShell
      overlay={
        <div className="tx-placeholder-body">
          <div className="tx-state" role={role}>
            <span className={tone ? `tx-state-mark tx-state-mark--${tone}` : "tx-state-mark"} aria-hidden="true">
              {icon}
            </span>
            <span className="tx-state-text">
              <span className="tx-state-title">{title}</span>
              <span className="tx-state-body">{body}</span>
            </span>
            {onAction && (
              <button type="button" className="tx-state-action" onClick={onAction}>
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

function NetSummary({ totals, isFirstLoad, hasError }) {
  const isBlank = hasError;

  return (
    <section className="tx-card tx-net" aria-label="Dönem özeti">
      <div className="tx-net-top">
        <span className="tx-net-label">
          <span className="tx-net-mark" aria-hidden="true">
            <FiTrendingUp />
          </span>
          Net
        </span>
        {isFirstLoad ? (
          <span className="tx-net-value tx-skeleton" aria-hidden="true" />
        ) : (
          <span className={isBlank ? "tx-net-value tx-net-value--blank" : `tx-net-value ${netToneClass(totals.net)}`}>
            {isBlank ? "—" : formatSignedCurrency(totals.net)}
          </span>
        )}
      </div>

      {isFirstLoad ? (
        <span className="tx-net-amounts tx-skeleton" aria-hidden="true" />
      ) : (
        <span className="tx-net-amounts">
          {isBlank ? (
            "Dönem özeti okunamadı"
          ) : (
            <>
              <b>{formatSignedCurrency(totals.totalIncome)}</b> · <b>{formatSignedCurrency(-totals.totalExpense)}</b>
            </>
          )}
        </span>
      )}
    </section>
  );
}

function netToneClass(net) {
  return net < 0 ? "tx-net-value--negative" : "tx-net-value--positive";
}

function CardAction({ icon, tone, label, onClick }) {
  return (
    <button type="button" className="tx-card-action" onClick={onClick}>
      <span className={`tx-card-action-mark tx-card-action-mark--${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="tx-card-action-title">{label}</span>
    </button>
  );
}

function ActionsCard({ onAdd }) {
  return (
    <section className="tx-card tx-actions" aria-label="İlgili işlemler">
      <span className="tx-card-title">İlgili İşlemler</span>
      <div className="tx-card-actions">
        <CardAction icon={<FiArrowUpCircle />} tone="positive" label="Gelir Ekle" onClick={() => onAdd("income")} />
        <CardAction icon={<FiArrowDownCircle />} tone="negative" label="Gider Ekle" onClick={() => onAdd("expense")} />
      </div>
    </section>
  );
}

function PagesCard({ onNavigate }) {
  return (
    <section className="tx-card tx-pages" aria-label="İlgili sayfalar">
      <span className="tx-card-title">İlgili Sayfalar</span>
      <div className="tx-shortcuts">
        <button type="button" className="tx-shortcut" onClick={() => onNavigate("/dues")}>
          <FiEye aria-hidden="true" />
          Aidat Takibi
        </button>
        <button type="button" className="tx-shortcut" onClick={() => onNavigate("/reports")}>
          <FiFileText aria-hidden="true" />
          Raporlar
        </button>
      </div>
    </section>
  );
}

function TransactionsControlBar({
  transactions,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  typeFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  isFirstLoad,
}) {
  const counts = transactions.reduce(
    (acc, transaction) => {
      acc[transaction.type] += 1;
      return acc;
    },
    { all: transactions.length, income: 0, expense: 0 },
  );

  return (
    <section className="page-band tx-control-row" aria-label="Dönem, filtre ve arama">
      {FILTER_PILLS.map((pill) => {
        const isActive = typeFilter === pill.key;
        const modifier = pill.key === "all" ? "" : ` tx-pill--${pill.key}`;

        return (
          <button
            key={pill.key}
            type="button"
            className={`tx-pill${modifier}${isActive ? " tx-pill--active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            disabled={isFirstLoad}
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="tx-pill-dot" aria-hidden="true" />}
            {pill.label}
            {!isFirstLoad && <span className="tx-pill-count">{counts[pill.key]}</span>}
          </button>
        );
      })}

      <SearchBox
        label="Açıklama veya kategori ara"
        value={searchTerm}
        disabled={isFirstLoad}
        onChange={onSearchChange}
      />

      <PeriodSelector
        year={selectedYear}
        month={selectedMonth}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
    </section>
  );
}

function Transactions() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageKey, setPageKey] = useState("");
  const [addType, setAddType] = useState(null);

  const { transactions, totals, start, isFirstLoad, errorMessage, loadTransactions } = useTransactions(
    building.id,
    selectedYear,
    selectedMonth,
  );

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedMonth((month) => clampMonth(year, month));
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setSearchTerm("");
  };

  const goToStartPeriod = () => {
    setSelectedYear(start.year);
    setSelectedMonth(start.month);
  };

  const isBeforeStart = Boolean(start) && toPeriod(selectedYear, selectedMonth) < toPeriod(start.year, start.month);

  const handleCancel = async (transaction) => {
    const reason = await showDialog.cancelReason(`${transaction.type === "income" ? "Geliri" : "Gideri"} İptal Et`);
    if (!reason) return;

    const cancelTransaction =
      transaction.type === "income" ? window.electronAPI.cancelIncome : window.electronAPI.cancelExpense;

    try {
      const res = await cancelTransaction({
        id: transaction.id,
        buildingId: building.id,
        userId: session.id,
        reason,
      });
      if (res.success) {
        showDialog.toast(res.message);
        loadTransactions();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Transactions] cancelTransaction:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
  };

  const term = searchKey(searchTerm).trim();
  const filteredTransactions = transactions.filter((transaction) => {
    if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
    if (!term) return true;
    const categoryLabel = TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category;
    return searchKey(transaction.description).includes(term) || searchKey(categoryLabel).includes(term);
  });

  const nextPageKey = `${typeFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`;
  if (pageKey !== nextPageKey) {
    setPageKey(nextPageKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedTransactions = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
          title="İşlem listesi okunamadı"
          body={errorMessage}
          actionIcon={<FiRefreshCw />}
          actionLabel="Yeniden Dene"
          onAction={loadTransactions}
          role="alert"
        />
      );
    }

    if (transactions.length === 0) {
      if (isBeforeStart) {
        return (
          <ListPlaceholder
            icon={<FiCalendar />}
            tone="muted"
            title="Bu dönemde kayıt yok"
            body={`Bu binanın kasa hareketleri ${formatMonthYear(start.year, start.month)} ayında başlıyor.`}
            actionIcon={<FiSkipBack />}
            actionLabel="Kayıtların Başladığı Aya Git"
            onAction={goToStartPeriod}
          />
        );
      }

      return (
        <ListPlaceholder
          icon={<FiCalendar />}
          tone="muted"
          title="Bu dönemde kayıt yok"
          body={`${formatMonthYear(selectedYear, selectedMonth)} için girilmiş gelir ya da gider bulunmuyor.`}
          actionIcon={<FiArrowUpCircle />}
          actionLabel="Gelir Ekle"
          onAction={() => setAddType("income")}
        />
      );
    }

    if (filteredTransactions.length === 0) {
      return (
        <ListPlaceholder
          icon={<FiSearch />}
          tone="muted"
          title="Eşleşen kayıt yok"
          body="Seçili filtre ve arama ile listelenecek kayıt bulunamadı."
          actionIcon={<FiRefreshCw />}
          actionLabel="Filtreyi Temizle"
          onAction={clearFilters}
        />
      );
    }

    return (
      <TableShell spacerCount={PAGE_SIZE - pagedTransactions.length}>
        {pagedTransactions.map((transaction) => (
          <TransactionRow
            key={`${transaction.type}-${transaction.id}`}
            transaction={transaction}
            onCancel={() => handleCancel(transaction)}
          />
        ))}
      </TableShell>
    );
  };

  return (
    <div className="transactions-container">
      <PageHeader title="Gelir ve Gider" />

      <TransactionsControlBar
        transactions={transactions}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={handleYearChange}
        typeFilter={typeFilter}
        onFilterChange={setTypeFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isFirstLoad={isFirstLoad}
      />

      <section className="page-band" aria-label="İşlem listesi">
        <div className="tx-list-split">
          <div className="tx-list-main">{renderList()}</div>

          <div className="tx-rail">
            <NetSummary totals={totals} isFirstLoad={isFirstLoad} hasError={Boolean(errorMessage)} />
            <ActionsCard onAdd={setAddType} />
            <PagesCard onNavigate={navigate} />
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </section>

      {addType && (
        <TransactionModal
          type={addType}
          building={building}
          onClose={() => setAddType(null)}
          onSaved={() => {
            setAddType(null);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}

export default Transactions;

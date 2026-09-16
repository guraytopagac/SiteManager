import { useState } from "react";
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
import DetailModal from "./TransactionsModals/DetailModal";
import DocumentModal from "./TransactionsModals/DocumentModal";
import TransactionModal from "./TransactionsModals/TransactionModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
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
  const [res, loadTransactions] = useIpcData("getTransactions", { buildingId, period: { year, month } });

  return {
    transactions: res.success ? res.data : [],
    totals: res.success ? res.totals : EMPTY_TOTALS,
    start: res.success ? res.start : null,
    errorMessage: res.success ? "" : res.message || "İşlem listesi alınamadı.",
    loadTransactions,
  };
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

function TransactionRow({ transaction, onOpen }) {
  const signedAmount = transaction.type === "income" ? transaction.amount : -transaction.amount;

  return (
    <tr className={transaction.is_cancelled ? "tx-row--cancelled" : undefined}>
      <td className="tx-date">{formatDate(transaction.date)}</td>
      <td className="tx-category">{TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category}</td>
      <td className="tx-desc" title={transaction.description || undefined}>
        {transaction.is_cancelled ? <span className="tx-cancelled-tag">İptal edildi ·</span> : null}
        {transaction.description || "—"}
      </td>
      <td className={`tx-amount tx-amount--${transaction.type}`}>{formatSignedCurrency(signedAmount)}</td>
      <td>
        <button type="button" className="tx-detail-btn" onClick={onOpen}>
          Detay
        </button>
      </td>
    </tr>
  );
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

function NetRow({ label, tone, amount, isBlank }) {
  return (
    <div className="tx-net-row">
      <span>{label}</span>
      <b className={isBlank ? "tx-net--zero" : `tx-net--${tone}`}>{isBlank ? "—" : formatSignedCurrency(amount)}</b>
    </div>
  );
}

function NetSummary({ totals, hasError }) {
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
        <span className={isBlank ? "tx-net-value tx-net--zero" : `tx-net-value ${netToneClass(totals.net)}`}>
          {isBlank ? "—" : formatSignedCurrency(totals.net)}
        </span>
      </div>

      <div className="tx-net-split">
        <NetRow label="Gelir" tone="positive" amount={totals.totalIncome} isBlank={isBlank} />
        <NetRow label="Gider" tone="negative" amount={-totals.totalExpense} isBlank={isBlank} />
      </div>
    </section>
  );
}

function netToneClass(amount) {
  if (amount > 0) return "tx-net--positive";
  if (amount < 0) return "tx-net--negative";
  return "tx-net--zero";
}

function CardAction({ icon, label, onClick }) {
  return (
    <button type="button" className="tx-card-action" onClick={onClick}>
      <span className="tx-card-action-mark" aria-hidden="true">
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
        <CardAction icon={<FiArrowUpCircle />} label="Gelir Ekle" onClick={() => onAdd("income")} />
        <CardAction icon={<FiArrowDownCircle />} label="Gider Ekle" onClick={() => onAdd("expense")} />
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
}) {
  const filterCounts = transactions.reduce(
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
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="tx-pill-dot" aria-hidden="true" />}
            {pill.label}
            <span className="tx-pill-count">{filterCounts[pill.key]}</span>
          </button>
        );
      })}

      <SearchBox label="Açıklama veya kategori ara" value={searchTerm} onChange={onSearchChange} />

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
  const [addType, setAddType] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [documentTarget, setDocumentTarget] = useState(null);

  const { transactions, totals, start, errorMessage, loadTransactions } = useTransactions(
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
    if (!reason) return false;

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
        return true;
      }
      showDialog.error("Hata", res.message);
    } catch (err) {
      console.error("[Transactions] cancelTransaction:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    return false;
  };

  const cancelFromDetail = async () => {
    if (await handleCancel(detailTarget)) {
      setDetailTarget(null);
    }
  };

  const openDocument = () => {
    setDocumentTarget(detailTarget);
    setDetailTarget(null);
  };

  const term = searchKey(searchTerm);
  const filteredTransactions = transactions.filter((transaction) => {
    if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
    if (!term) return true;
    const categoryLabel = TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category;
    return searchKey(transaction.description).includes(term) || searchKey(categoryLabel).includes(term);
  });

  const {
    pageItems: pagedTransactions,
    currentPage,
    pageCount,
    setPage,
  } = usePagination(filteredTransactions, PAGE_SIZE, `${typeFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`);

  const renderList = () => {
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
            onOpen={() => setDetailTarget(transaction)}
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
      />

      <section className="page-band" aria-label="İşlem listesi">
        <div className="tx-list-split">
          <div className="tx-list-main">{renderList()}</div>

          <div className="tx-rail">
            <NetSummary totals={totals} hasError={Boolean(errorMessage)} />
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

      {detailTarget && (
        <DetailModal
          transaction={detailTarget}
          building={building}
          onClose={() => setDetailTarget(null)}
          onCreateDocument={openDocument}
          onCancel={cancelFromDetail}
        />
      )}

      {documentTarget && (
        <DocumentModal
          transaction={documentTarget}
          building={building}
          onClose={() => setDocumentTarget(null)}
          onSaved={() => setDocumentTarget(null)}
        />
      )}
    </div>
  );
}

export default Transactions;

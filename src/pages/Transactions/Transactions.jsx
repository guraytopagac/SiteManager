// The cash ledger: income and expense records, their cancellation and the documents printed from them.
// Entry lives in a modal opened from the rail, the only place it can be opened from. The rail also shows how
// the main cash splits into cash on hand and the bank, and moves money between the two.

import { useState } from "react";
import {
  FiAlertTriangle,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiRepeat,
  FiSearch,
  FiSkipBack,
  FiTrendingUp,
} from "react-icons/fi";
import "./Transactions.css";
import CancelReasonModal from "@/components/SharedModals/CancelReasonModal/CancelReasonModal";
import { showDialog } from "@/components/Dialog/dialogStore";
import DocumentModal from "@/components/SharedModals/DocumentModal/DocumentModal";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import SearchBox from "@/components/SearchBox/SearchBox";
import DetailModal from "./TransactionsModals/DetailModal";
import TransactionModal from "./TransactionsModals/TransactionModal";
import TransferModal from "./TransactionsModals/TransferModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import { CASH_ACCOUNT_LABELS, TRANSACTION_CATEGORY_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
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

const EMPTY_BALANCES = { cash: 0, bank: 0 };

// A fund payout is money going out, so the expense pill lists it even though the totals leave it out. A
// transfer between cash and bank is neither and only shows under all.
function filterType(transaction) {
  return transaction.type === "severance_payout" ? "expense" : transaction.type;
}

const CANCEL_TEXT = {
  income: { title: "Geliri İptal Et", method: "cancelIncome" },
  expense: { title: "Gideri İptal Et", method: "cancelExpense" },
  transfer: { title: "Aktarımı İptal Et", method: "cancelCashTransfer" },
};

function useTransactions(buildingId, year, month) {
  const [res, loadTransactions] = useIpcData("getTransactions", { buildingId, period: { year, month } });

  return {
    transactions: res.success ? res.data : [],
    totals: res.success ? res.totals : EMPTY_TOTALS,
    balances: res.success ? res.balances : EMPTY_BALANCES,
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

// A fund payout and a transfer are listed but never counted, so they take no sign.
function rowAmount(transaction) {
  if (transaction.type === "severance_payout" || transaction.type === "transfer") {
    return formatCurrency(transaction.amount);
  }
  return formatSignedCurrency(transaction.type === "income" ? transaction.amount : -transaction.amount);
}

function rowClass(transaction) {
  if (transaction.is_cancelled) return "tx-row--cancelled";
  if (transaction.type === "severance_payout") return "tx-row--fund";
  return undefined;
}

// Stands in for the empty description of an advance or its repayment. Null for every other record.
function advanceSentence(transaction) {
  if (transaction.description || !transaction.employee_name) return null;
  const amount = formatCurrency(transaction.amount);
  return transaction.category === "staff_advance"
    ? `${transaction.employee_name} adındaki çalışana ${amount} avans ödemesi yapılmıştır.`
    : `${transaction.employee_name} adındaki çalışan ${amount} avans iadesi yapmıştır.`;
}

// An advance or a repayment leads with the employee's name, so the row says whose money it is. Without a
// description of its own it reads as a full sentence instead.
function rowDescription(transaction) {
  if (!transaction.employee_name) return transaction.description;
  return transaction.description
    ? `${transaction.employee_name} · ${transaction.description}`
    : advanceSentence(transaction);
}

// No type column: the amount carries its own sign and colour. A cancelled record says so as a prefix in the
// description, and the flag is 0 or 1 from the database, so a conditional is used: React prints a bare zero.
function TransactionRow({ transaction, onOpen }) {
  const isFundPayout = transaction.type === "severance_payout";
  const description = rowDescription(transaction);

  return (
    <tr className={rowClass(transaction)}>
      <td className="tx-date">{formatDate(transaction.date)}</td>
      <td className="tx-category">{TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category}</td>
      <td className="tx-desc" title={description || undefined}>
        {transaction.is_cancelled ? <span className="tx-cancelled-tag">İptal edildi ·</span> : null}
        {isFundPayout && !transaction.is_cancelled ? <span className="tx-fund-tag">Tazminat kasasından ·</span> : null}
        {transaction.is_investment === 1 && !transaction.is_cancelled ? (
          <span className="tx-investment-tag">Yatırım fonundan ·</span>
        ) : null}
        {description || "—"}
      </td>
      <td className={`tx-amount tx-amount--${transaction.type}`}>{rowAmount(transaction)}</td>
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

// The breakdown rows keep their colour at zero, since they state a direction. The net figure is a
// measurement, so zero reads as neutral there.
function NetRow({ label, tone, amount, isBlank }) {
  return (
    <div className="tx-net-row">
      <span>{label}</span>
      <b className={isBlank ? "tx-net--zero" : `tx-net--${tone}`}>{isBlank ? "—" : formatSignedCurrency(amount)}</b>
    </div>
  );
}

function NetSummary({ totals, hasError, hasSeverancePayouts }) {
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

      {hasSeverancePayouts ? (
        <p className="tx-net-note">Tazminat kasasından yapılan ödemeler toplama dahil değildir.</p>
      ) : null}
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

const ACCOUNT_ICONS = {
  cash: <FiDollarSign />,
  bank: <FiCreditCard />,
};

// Today's split of the main cash, whatever period the list shows. A balance can go below zero when the
// split of older records is off, so it is printed with its sign and a transfer corrects it.
function AccountsCard({ balances, hasError, onTransfer }) {
  return (
    <section className="tx-card tx-accounts" aria-label="Ana kasa">
      <span className="tx-card-title">Ana Kasa</span>
      <div className="tx-account-rows">
        {Object.entries(CASH_ACCOUNT_LABELS).map(([account, label]) => (
          <div key={account} className="tx-account-row">
            <span className="tx-account-mark" aria-hidden="true">
              {ACCOUNT_ICONS[account]}
            </span>
            <span className="tx-account-label">{label}</span>
            <b className={balances[account] < 0 ? "tx-net--negative" : undefined}>
              {hasError ? "—" : formatCurrency(balances[account])}
            </b>
          </div>
        ))}
      </div>
      <CardAction icon={<FiRepeat />} label="Aktarım Yap" onClick={onTransfer} />
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
      acc[filterType(transaction)] += 1;
      return acc;
    },
    { all: transactions.length, income: 0, expense: 0, transfer: 0 },
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
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [addType, setAddType] = useState(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);
  const [documentTarget, setDocumentTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const { transactions, totals, balances, start, errorMessage, loadTransactions } = useTransactions(
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

  // Unlike the apartment lists, the query is filtered by period, so an empty month before the ledger and a
  // quiet one in the middle look alike. The first recorded month tells them apart.
  const isBeforeStart = Boolean(start) && toPeriod(selectedYear, selectedMonth) < toPeriod(start.year, start.month);

  // Reports whether the record was cancelled, so the reason box stays open when the service refuses and the
  // detail behind it closes only on success.
  const cancelTransaction = async (reason) => {
    try {
      const res = await window.electronAPI[CANCEL_TEXT[cancelTarget.type].method]({
        id: cancelTarget.id,
        buildingId: building.id,
        userId: session.id,
        reason,
      });
      if (res.success) {
        showDialog.toast(res.message);
        setCancelTarget(null);
        setDetailTarget(null);
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

  const openDocument = () => {
    setDocumentTarget(detailTarget);
    setDetailTarget(null);
  };

  const term = searchKey(searchTerm);
  const filteredTransactions = transactions.filter((transaction) => {
    if (typeFilter !== "all" && filterType(transaction) !== typeFilter) return false;
    if (!term) return true;
    const categoryLabel = TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category;
    return searchKey(rowDescription(transaction)).includes(term) || searchKey(categoryLabel).includes(term);
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
      <PageHeader title="Kasa Defteri" />

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
            <NetSummary
              totals={totals}
              hasError={Boolean(errorMessage)}
              hasSeverancePayouts={transactions.some((transaction) => transaction.type === "severance_payout")}
            />
            <ActionsCard onAdd={setAddType} />
            <AccountsCard
              balances={balances}
              hasError={Boolean(errorMessage)}
              onTransfer={() => setIsTransferOpen(true)}
            />
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </section>

      {addType && (
        <TransactionModal
          type={addType}
          building={building}
          balances={balances}
          onClose={() => setAddType(null)}
          onSaved={() => {
            setAddType(null);
            loadTransactions();
          }}
        />
      )}

      {isTransferOpen && (
        <TransferModal
          building={building}
          userId={session.id}
          balances={balances}
          onClose={() => setIsTransferOpen(false)}
          onSaved={() => {
            setIsTransferOpen(false);
            loadTransactions();
          }}
        />
      )}

      {detailTarget && (
        <DetailModal
          transaction={detailTarget}
          description={detailTarget.description ?? advanceSentence(detailTarget)}
          building={building}
          onClose={() => {
            // The reason box sits on top, and one Escape must close only that layer.
            if (!cancelTarget) setDetailTarget(null);
          }}
          onCreateDocument={openDocument}
          onCancel={() => setCancelTarget(detailTarget)}
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

      {cancelTarget && (
        <CancelReasonModal
          title={CANCEL_TEXT[cancelTarget.type].title}
          scope={`${TRANSACTION_CATEGORY_LABELS[cancelTarget.category] ?? cancelTarget.category} · ${formatCurrency(cancelTarget.amount)}`}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancelTransaction}
        />
      )}
    </div>
  );
}

export default Transactions;

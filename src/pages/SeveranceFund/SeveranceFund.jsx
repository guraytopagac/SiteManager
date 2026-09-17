// The severance fund of the building: money moved out of the main cash every month to pay the staff's
// severance when they leave. Until the fund is started the page is only the start form.

import { useState } from "react";
import {
  FiAlertTriangle,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiBriefcase,
  FiEdit2,
  FiRefreshCw,
  FiRepeat,
  FiUserPlus,
} from "react-icons/fi";
import "./SeveranceFund.css";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import DetailModal from "./SeveranceFundModals/DetailModal";
import EmployeeModal from "./SeveranceFundModals/EmployeeModal";
import FundSettingsModal from "./SeveranceFundModals/FundSettingsModal";
import PayoutModal from "./SeveranceFundModals/PayoutModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { showDialog } from "@/utils/dialog";
import { formatDate, formatMonthYear, getCurrentMonth, getCurrentYear } from "@/utils/date";

// The payout column is not called an estimate, since a paid employee shows the paid amount there.
const COLUMNS = ["Görev", "Çalışan", "İşe Giriş", "Çalışılan Gün", "Brüt Ücret", "Tazminat", "İşlem"];

// Five rows fit the panel of the tallest shell even when every row is a leaver with two lines.
const PAGE_SIZE = 5;

const MAX_OPENING_BALANCE = 100000000;
const MAX_MONTHLY_AMOUNT = 1000000;

// Title and icon of each movement type.
const MOVEMENT_TYPES = {
  opening: { title: "Açılış bakiyesi", icon: <FiBriefcase /> },
  monthly: { title: "Aylık aktarım", icon: <FiRepeat /> },
  top_up: { title: "Ana kasadan ek aktarım", icon: <FiArrowUpCircle /> },
  payout: { title: "Tazminat ödemesi", icon: <FiArrowDownCircle /> },
};

function nextPeriod(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// A typed 12.345 is never sent as is.
function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatDays(days) {
  return `${days.toLocaleString("tr-TR")} gün`;
}

function useSeveranceFund(buildingId) {
  const [res, reload] = useIpcData("getSeveranceOverview", { buildingId });

  return {
    overview: res.success ? res.data : null,
    errorMessage: res.success ? "" : res.message || "Tazminat kasası bilgileri alınamadı.",
    reload,
  };
}

function ErrorPanel({ title, body, onRetry }) {
  return (
    <section className="page-band sf-state-band">
      <div className="sf-state" role="alert">
        <span className="sf-state-mark" aria-hidden="true">
          <FiAlertTriangle />
        </span>
        <span className="sf-state-text">
          <span className="sf-state-title">{title}</span>
          <span className="sf-state-body">{body}</span>
        </span>
        <button type="button" className="sf-state-action" onClick={onRetry}>
          <FiRefreshCw />
          Yeniden Dene
        </button>
      </div>
    </section>
  );
}

// Only this month or next month can be picked, so no past month is charged to the main cash.
function FundStartForm({ building, onStarted }) {
  const thisYear = getCurrentYear();
  const thisMonth = getCurrentMonth();
  const nextMonth = nextPeriod(thisYear, thisMonth);

  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [monthlyAmountInput, setMonthlyAmountInput] = useState("");
  const [startsThisMonth, setStartsThisMonth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startChoices = [
    {
      value: true,
      title: "Bu ay",
      body: `İlk aktarım ${formatMonthYear(thisYear, thisMonth)} için hemen yapılır.`,
    },
    {
      value: false,
      title: "Gelecek ay",
      body: `İlk aktarım ${formatMonthYear(nextMonth.year, nextMonth.month)} ayında yapılır.`,
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    const openingBalance = openingBalanceInput === "" ? 0 : roundToCents(openingBalanceInput);
    const monthlyAmount = roundToCents(monthlyAmountInput);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      showDialog.warning("Geçersiz Tutar", "Açılış bakiyesi 0 ya da daha büyük olmalıdır.");
      return;
    }
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Aylık aktarım tutarı 0'dan büyük olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.setupSeveranceFund({
        buildingId: building.id,
        openingBalance,
        monthlyAmount,
        startsThisMonth,
      });
      if (res.success) {
        showDialog.toast(res.message);
        onStarted();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SeveranceFund] setupSeveranceFund:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  return (
    <section className="page-band sf-setup-band" aria-label="Tazminat kasasını başlat">
      <form className="sf-setup" onSubmit={handleSubmit}>
        <div className="sf-setup-intro">
          <span className="sf-setup-mark" aria-hidden="true">
            <FiBriefcase />
          </span>
          <div>
            <h2 className="sf-setup-title">Tazminat Kasasını Başlat</h2>
            <p className="sf-setup-body">
              Belirlenen tutar her ay ana kasadan tazminat kasasına aktarılır. Tazminat kasasında daha önce biriken para
              varsa açılış bakiyesi olarak girilir.
            </p>
          </div>
        </div>

        <div className="sf-setup-grid">
          <div className="sf-field">
            <label htmlFor="sf-opening">Açılış Bakiyesi (₺)</label>
            <input
              id="sf-opening"
              type="number"
              step="0.01"
              min="0"
              max={MAX_OPENING_BALANCE}
              placeholder="Örn. 25000"
              value={openingBalanceInput}
              onChange={(e) => setOpeningBalanceInput(e.target.value)}
              onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
              autoFocus
            />
          </div>

          <div className="sf-field">
            <label htmlFor="sf-monthly">Aylık Aktarım Tutarı (₺)</label>
            <input
              id="sf-monthly"
              type="number"
              step="0.01"
              min="0.01"
              max={MAX_MONTHLY_AMOUNT}
              placeholder="Örn. 3500"
              value={monthlyAmountInput}
              onChange={(e) => setMonthlyAmountInput(e.target.value)}
              onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
              required
            />
          </div>

          <div className="sf-field sf-field--wide">
            <span className="sf-legend" id="sf-start-label">
              Başlangıç Ayı
            </span>
            <div className="sf-choices" role="radiogroup" aria-labelledby="sf-start-label">
              {startChoices.map((choice) => (
                <label
                  key={choice.title}
                  className={startsThisMonth === choice.value ? "sf-choice sf-choice--active" : "sf-choice"}
                >
                  <input
                    type="radio"
                    name="sf-start"
                    checked={startsThisMonth === choice.value}
                    onChange={() => setStartsThisMonth(choice.value)}
                  />
                  <span className="sf-choice-title">{choice.title}</span>
                  <span className="sf-choice-body">{choice.body}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="sf-btn-solid sf-setup-submit" disabled={isSubmitting}>
          {isSubmitting ? "Başlatılıyor..." : "Tazminat Kasasını Başlat"}
        </button>
      </form>
    </section>
  );
}

// Every metric carries one line below its figure so the three cells stay the same height. A surplus gets no
// line of its own, it is already readable from the two figures side by side.
function SummaryStrip({ fund, totals, employees, onEdit }) {
  const activeEmployees = employees.filter((employee) => !employee.end_date);
  const notEligibleCount = activeEmployees.filter((employee) => !employee.is_eligible).length;

  let staffLine = "Aktif çalışan yok";
  if (activeEmployees.length > 0) {
    staffLine = `${activeEmployees.length} aktif çalışan`;
    if (notEligibleCount > 0) {
      staffLine += ` · ${notEligibleCount} kişi henüz hak kazanmadı`;
    }
  }

  return (
    <section className="page-band" aria-label="Tazminat kasası özeti">
      <div className="sf-summary">
        <div className="sf-metric">
          <span className="sf-metric-label">Tazminat Kasası Bakiyesi</span>
          <span className="sf-metric-value">{formatCurrency(totals.balance)}</span>
          {totals.shortfall > 0 ? (
            <span className="sf-metric-meta sf-metric-meta--danger">
              Yükümlülüğün {formatCurrency(totals.shortfall)} gerisinde
            </span>
          ) : (
            <span className="sf-metric-meta">{formatDate(fund.startedOn)} tarihinde başlatıldı</span>
          )}
        </div>

        <div className="sf-metric">
          <span className="sf-metric-label">Tahmini Yükümlülük</span>
          <span className="sf-metric-value">{formatCurrency(totals.liability)}</span>
          <span className="sf-metric-meta">{staffLine}</span>
        </div>

        <div className="sf-metric">
          <span className="sf-metric-label">
            Aylık Aktarım
            <button type="button" className="sf-metric-edit" onClick={onEdit}>
              <FiEdit2 aria-hidden="true" />
              Düzenle
            </button>
          </span>
          <span className="sf-metric-value">{formatCurrency(fund.monthlyAmount)}</span>
          <span className="sf-metric-meta">
            {fund.monthlyAmount > 0
              ? `Sonraki aktarım ${formatMonthYear(fund.nextTransfer.year, fund.nextTransfer.month)}`
              : "Aktarım durduruldu"}
          </span>
        </div>
      </div>
    </section>
  );
}

// Every cell is one line so all rows are the same height and a full page fits the panel without scrolling.
// Longer wording and every action live in the detail modal.
function EmployeeRow({ employee, onDetail }) {
  const hasLeft = Boolean(employee.end_date);

  let estimateCell;
  if (hasLeft) {
    estimateCell = employee.payout_id ? (
      <span className="sf-number">{formatCurrency(employee.payout_amount)}</span>
    ) : (
      "Ödeme yok"
    );
  } else if (employee.is_eligible) {
    estimateCell = <span className="sf-number">{formatCurrency(employee.liability)}</span>;
  } else {
    estimateCell = <span className="sf-muted">Hak doğmadı</span>;
  }

  return (
    <tr className={hasLeft ? "sf-row--left" : undefined}>
      <td title={employee.role || undefined}>{employee.role || "—"}</td>
      <td title={employee.full_name}>{employee.full_name}</td>
      <td>{formatDate(employee.start_date)}</td>
      <td className="sf-number">{formatDays(employee.worked_days)}</td>
      <td className="sf-number">{formatCurrency(employee.gross_wage)}</td>
      <td>{estimateCell}</td>
      <td>
        <button type="button" className="sf-row-btn" onClick={onDetail}>
          Detay
        </button>
      </td>
    </tr>
  );
}

function EmployeesPanel({ employees, onAdd, onDetail }) {
  const { pageItems, currentPage, pageCount, setPage } = usePagination(employees, PAGE_SIZE);

  return (
    <section className="sf-panel" aria-label="Çalışanlar">
      <div className="sf-panel-head">
        <h2 className="sf-panel-title">Çalışanlar</h2>
        <button type="button" className="sf-btn-solid sf-panel-action" onClick={onAdd}>
          <FiUserPlus aria-hidden="true" />
          Çalışan Ekle
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="sf-empty">
          <span className="sf-empty-title">Kayıtlı çalışan yok</span>
          <span className="sf-empty-body">
            Tahmini tazminat, eklenen çalışanların ücreti ve çalışma süresinden hesaplanır.
          </span>
        </div>
      ) : (
        <div className="sf-table-scroll">
          <table className="sf-table">
            <thead>
              <tr>
                {COLUMNS.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((employee) => (
                <EmployeeRow key={employee.id} employee={employee} onDetail={() => onDetail(employee)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sf-panel-foot">
        <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
      </div>
    </section>
  );
}

// A payout is the only movement that takes money out of the fund, so it alone prints with a minus.
// The flag is 0 or 1 from the database, so every condition on it is a ternary: React prints a bare zero.
function MovementItem({ movement, onCancel }) {
  const type = MOVEMENT_TYPES[movement.type];
  const isPayout = movement.type === "payout";
  const isYear = Boolean(movement.year);

  return (
    <li className={movement.is_cancelled ? "sf-movement sf-movement--cancelled" : "sf-movement"}>
      <span className={`sf-movement-mark sf-movement-mark--${movement.type}`} aria-hidden="true">
        {type.icon}
      </span>
      <div className="sf-movement-main">
        <span className="sf-movement-title">{isYear ? "Aylık aktarımlar" : type.title}</span>
        {isPayout ? <span className="sf-movement-person">{movement.employee_name}</span> : null}
        <span className="sf-movement-date">
          {isYear ? `${movement.year} · ${movement.count} ay` : formatDate(movement.date)}
        </span>
        {isPayout && movement.top_up_amount ? (
          <span className="sf-movement-note">{formatCurrency(movement.top_up_amount)} ana kasadan eklendi.</span>
        ) : null}
        {isPayout && movement.note ? <span className="sf-movement-note">Not: {movement.note}</span> : null}
        {movement.is_cancelled && isPayout ? (
          <span className="sf-movement-cancel">
            İptal: {movement.cancel_reason} ({formatDate(movement.cancelled_at)})
          </span>
        ) : null}
        {movement.is_cancelled && !isPayout ? <span className="sf-movement-cancel">İptal edildi</span> : null}
        {isPayout && !movement.is_cancelled ? (
          <button type="button" className="sf-movement-btn" onClick={onCancel}>
            İptal Et
          </button>
        ) : null}
      </div>
      <span
        className={
          isPayout ? "sf-movement-amount sf-movement-amount--out" : "sf-movement-amount sf-movement-amount--in"
        }
      >
        {formatSignedCurrency(isPayout ? -movement.amount : movement.amount)}
      </span>
    </li>
  );
}

// Monthly transfers are the same row twelve times a year and would bury the payouts, so each year is
// folded into one row at the place of its newest transfer. The single months stay listed on the
// transactions page. Sums are added in cents so the total never picks up a float residue.
function groupMonthlyByYear(movements) {
  const years = new Map();
  const rows = [];
  for (const movement of movements) {
    if (movement.type !== "monthly") {
      rows.push(movement);
      continue;
    }
    const year = Number(movement.date.slice(0, 4));
    let row = years.get(year);
    if (!row) {
      row = { key: `monthly-${year}`, type: "monthly", year, count: 0, cents: 0 };
      years.set(year, row);
      rows.push(row);
    }
    row.count += 1;
    row.cents += Math.round(movement.amount * 100);
  }
  return rows.map((row) => (row.year ? { ...row, amount: row.cents / 100 } : row));
}

function MovementsPanel({ movements, onCancelPayout }) {
  const rows = groupMonthlyByYear(movements);

  return (
    <section className="sf-panel sf-movements-panel" aria-label="Tazminat kasası hareketleri">
      <div className="sf-panel-head">
        <h2 className="sf-panel-title">Hareketler</h2>
      </div>

      {movements.length === 0 ? (
        <div className="sf-empty">
          <span className="sf-empty-title">Henüz hareket yok</span>
          <span className="sf-empty-body">İlk aylık aktarım yapıldığında burada listelenir.</span>
        </div>
      ) : (
        <ul className="sf-movements">
          {rows.map((movement) => (
            <MovementItem key={movement.key} movement={movement} onCancel={() => onCancelPayout(movement)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SeveranceFund() {
  const session = useSession();
  const building = useCurrentBuilding();
  const { overview, errorMessage, reload } = useSeveranceFund(building.id);

  const [isFundSettingsOpen, setIsFundSettingsOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  // null while adding a new employee.
  const [editedEmployee, setEditedEmployee] = useState(null);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  const openEmployeeModal = (employee) => {
    setEditedEmployee(employee);
    setIsEmployeeModalOpen(true);
  };

  const cancelPayout = async (movement) => {
    const reason = await showDialog.cancelReason("Tazminat Ödemesini İptal Et");
    if (!reason) return;

    try {
      const res = await window.electronAPI.cancelSeverancePayout({
        buildingId: building.id,
        payoutId: movement.id,
        userId: session.id,
        reason,
      });
      if (res.success) {
        showDialog.toast(res.message);
        reload();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SeveranceFund] cancelSeverancePayout:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
  };

  const renderBody = () => {
    if (errorMessage) {
      return <ErrorPanel title="Tazminat kasası okunamadı" body={errorMessage} onRetry={reload} />;
    }

    if (!overview) {
      return <FundStartForm building={building} onStarted={reload} />;
    }

    return (
      <>
        <SummaryStrip
          fund={overview.fund}
          totals={overview.totals}
          employees={overview.employees}
          onEdit={() => setIsFundSettingsOpen(true)}
        />

        <section className="page-band sf-split-band" aria-label="Çalışanlar ve hareketler">
          <div className="sf-split">
            <EmployeesPanel
              employees={overview.employees}
              onAdd={() => openEmployeeModal(null)}
              onDetail={setDetailTarget}
            />
            <MovementsPanel movements={overview.movements} onCancelPayout={cancelPayout} />
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="severance-container">
      <PageHeader title="Tazminat Kasası" />

      {renderBody()}

      {detailTarget && (
        <DetailModal
          employee={detailTarget}
          building={building}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            setDetailTarget(null);
            openEmployeeModal(detailTarget);
          }}
          onPay={() => {
            setDetailTarget(null);
            setPayoutTarget(detailTarget);
          }}
        />
      )}

      {isFundSettingsOpen && overview && (
        <FundSettingsModal
          building={building}
          fund={overview.fund}
          onClose={() => setIsFundSettingsOpen(false)}
          onSaved={() => {
            setIsFundSettingsOpen(false);
            reload();
          }}
        />
      )}

      {isEmployeeModalOpen && (
        <EmployeeModal
          building={building}
          employee={editedEmployee}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSaved={() => {
            setIsEmployeeModalOpen(false);
            reload();
          }}
        />
      )}

      {payoutTarget && overview && (
        <PayoutModal
          building={building}
          employee={payoutTarget}
          balance={overview.totals.balance}
          userId={session.id}
          onClose={() => setPayoutTarget(null)}
          onSaved={() => {
            setPayoutTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default SeveranceFund;

// The staff page of the building: the employees with their open advances, and the severance fund that pays
// them when they leave. Transfers into the fund are entered by hand on the cash book page. The employees are listed
// from the start, the fund summary and movements appear once the fund is started and the start form stands in
// for them until then.

import { useState } from "react";
import {
  FiAlertTriangle,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiBriefcase,
  FiRefreshCw,
  FiRepeat,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import "./Staff.css";
import CancelReasonModal from "@/components/SharedModals/CancelReasonModal/CancelReasonModal";
import { showDialog } from "@/components/Dialog/dialogStore";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import EmployeeDetailModal from "./StaffModals/EmployeeDetailModal";
import EmployeeFormModal from "./StaffModals/EmployeeFormModal";
import SeverancePayoutModal from "./StaffModals/SeverancePayoutModal";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import { MAX_OPENING_BALANCE, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";

// The payout column is not called an estimate, since a paid employee shows the paid amount there. The worked
// days gave their column to the open advance and are still read in the detail modal.
const COLUMNS = ["Görev", "Çalışan", "İşe Giriş", "Brüt Ücret", "Açık Avans", "Tazminat", "İşlem"];

// Five rows fit the panel of the tallest shell even when every row is a leaver with two lines.
const PAGE_SIZE = 5;

// Title and icon of each movement type.
const MOVEMENT_TYPES = {
  opening: { title: "Açılış bakiyesi", icon: <FiBriefcase /> },
  transfer: { title: "Ana kasadan aktarım", icon: <FiRepeat /> },
  top_up: { title: "Ana kasadan ek aktarım", icon: <FiArrowUpCircle /> },
  payout: { title: "Tazminat ödemesi", icon: <FiArrowDownCircle /> },
};

// A typed 12.345 is never sent as is.
function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

function useStaff(buildingId) {
  const [res, reload] = useIpcData("getStaffOverview", { buildingId });

  return {
    overview: res.success ? res.data : null,
    errorMessage: res.success ? "" : res.message || "Personel bilgileri alınamadı.",
    reload,
  };
}

function ErrorPanel({ title, body, onRetry }) {
  return (
    <section className="page-band st-state-band">
      <div className="st-state" role="alert">
        <span className="st-state-mark" aria-hidden="true">
          <FiAlertTriangle />
        </span>
        <span className="st-state-text">
          <span className="st-state-title">{title}</span>
          <span className="st-state-body">{body}</span>
        </span>
        <button type="button" className="st-state-action" onClick={onRetry}>
          <FiRefreshCw />
          Yeniden Dene
        </button>
      </div>
    </section>
  );
}

function FundStartForm({ building, onStarted }) {
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const openingBalance = openingBalanceInput === "" ? 0 : roundToCents(openingBalanceInput);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      showDialog.warning("Geçersiz Tutar", "Açılış bakiyesi 0 ya da daha büyük olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.setupSeveranceFund({ buildingId: building.id, openingBalance });
      if (res.success) {
        showDialog.toast(res.message);
        onStarted();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Staff] setupSeveranceFund:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  return (
    <section className="page-band st-setup-band" aria-label="Tazminat kasasını başlat">
      <form className="st-setup" onSubmit={handleSubmit}>
        <div className="st-setup-intro">
          <span className="st-setup-mark" aria-hidden="true">
            <FiBriefcase />
          </span>
          <div>
            <h2 className="st-setup-title">Tazminat Kasasını Başlat</h2>
            <p className="st-setup-body">
              Tazminat kasasına aktarım Kasa Defteri sayfasından, Tazminat Aktarımı kategorisiyle gider girilerek
              yapılır. Daha önce biriken para varsa açılış bakiyesi olarak girilir.
            </p>
          </div>
        </div>

        <div className="st-setup-grid">
          <div className="st-field">
            <label htmlFor="st-opening">Açılış Bakiyesi (₺)</label>
            <input
              id="st-opening"
              type="number"
              step="0.01"
              min="0"
              max={MAX_OPENING_BALANCE}
              placeholder="Örn. 25000"
              value={openingBalanceInput}
              onChange={(e) => setOpeningBalanceInput(e.target.value)}
              onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
            />
          </div>
        </div>

        <button type="submit" className="st-btn-solid st-setup-submit" disabled={isSubmitting}>
          {isSubmitting ? "Başlatılıyor..." : "Tazminat Kasasını Başlat"}
        </button>
      </form>
    </section>
  );
}

// Each cell is a single row: mark and label on the left, the figure on the right. Only a shortfall adds a line,
// a surplus is already readable from the two figures side by side.
function SummaryStrip({ totals }) {
  return (
    <section className="page-band" aria-label="Tazminat kasası özeti">
      <div className="st-summary">
        <div className="st-metric">
          <span className="st-metric-mark" aria-hidden="true">
            <FiBriefcase />
          </span>
          <span className="st-metric-text">
            <span className="st-metric-label">Tazminat Kasası Bakiyesi</span>
            {totals.shortfall > 0 ? (
              <span className="st-metric-meta--danger">Yükümlülüğün {formatCurrency(totals.shortfall)} gerisinde</span>
            ) : null}
          </span>
          <span className="st-metric-value">{formatCurrency(totals.balance)}</span>
        </div>

        <div className="st-metric">
          <span className="st-metric-mark" aria-hidden="true">
            <FiUsers />
          </span>
          <span className="st-metric-text">
            <span className="st-metric-label">Tahmini Yükümlülük</span>
          </span>
          <span className="st-metric-value">{formatCurrency(totals.liability)}</span>
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
      <span className="st-number">{formatCurrency(employee.payout_amount)}</span>
    ) : (
      "Ödeme yok"
    );
  } else if (employee.is_eligible) {
    estimateCell = <span className="st-number">{formatCurrency(employee.liability)}</span>;
  } else {
    estimateCell = <span className="st-muted">Hak doğmadı</span>;
  }

  return (
    <tr className={hasLeft ? "st-row--left" : undefined}>
      <td title={employee.role || undefined}>{employee.role || "—"}</td>
      <td title={employee.full_name}>{employee.full_name}</td>
      <td>{formatDate(employee.start_date)}</td>
      <td className="st-number">{formatCurrency(employee.gross_wage)}</td>
      <td>
        {employee.advance_balance > 0 ? (
          <span className="st-advance">{formatCurrency(employee.advance_balance)}</span>
        ) : (
          <span className="st-muted">—</span>
        )}
      </td>
      <td>{estimateCell}</td>
      <td>
        <button type="button" className="st-row-btn" onClick={onDetail}>
          Detay
        </button>
      </td>
    </tr>
  );
}

function EmployeesPanel({ employees, onAdd, onDetail }) {
  const { pageItems, currentPage, pageCount, setPage } = usePagination(employees, PAGE_SIZE);

  return (
    <section className="st-panel" aria-label="Çalışanlar">
      <div className="st-panel-head">
        <h2 className="st-panel-title">Çalışanlar</h2>
        <button type="button" className="st-btn-solid st-panel-action" onClick={onAdd}>
          <FiUserPlus aria-hidden="true" />
          Çalışan Ekle
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-title">Kayıtlı çalışan yok</span>
          <span className="st-empty-body">Çalışan eklendiğinde avansları ve tahmini tazminatı burada izlenir.</span>
        </div>
      ) : (
        <div className="st-table-scroll">
          <table className="st-table">
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

      <div className="st-panel-foot">
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

  return (
    <li className={movement.is_cancelled ? "st-movement st-movement--cancelled" : "st-movement"}>
      <span className={`st-movement-mark st-movement-mark--${movement.type}`} aria-hidden="true">
        {type.icon}
      </span>
      <div className="st-movement-main">
        <span className="st-movement-title">{type.title}</span>
        {isPayout ? <span className="st-movement-person">{movement.employee_name}</span> : null}
        <span className="st-movement-date">{formatDate(movement.date)}</span>
        {isPayout && movement.top_up_amount ? (
          <span className="st-movement-note">{formatCurrency(movement.top_up_amount)} ana kasadan eklendi.</span>
        ) : null}
        {isPayout && movement.note ? <span className="st-movement-note">Not: {movement.note}</span> : null}
        {movement.is_cancelled && isPayout ? (
          <span className="st-movement-cancel">
            İptal: {movement.cancel_reason} ({formatDate(movement.cancelled_at)})
          </span>
        ) : null}
        {movement.is_cancelled && !isPayout ? <span className="st-movement-cancel">İptal edildi</span> : null}
        {isPayout && !movement.is_cancelled ? (
          <button type="button" className="st-movement-btn" onClick={onCancel}>
            İptal Et
          </button>
        ) : null}
      </div>
      <span
        className={
          isPayout ? "st-movement-amount st-movement-amount--out" : "st-movement-amount st-movement-amount--in"
        }
      >
        {formatSignedCurrency(isPayout ? -movement.amount : movement.amount)}
      </span>
    </li>
  );
}

function MovementsPanel({ movements, onCancelPayout }) {
  return (
    <section className="st-panel st-movements-panel" aria-label="Tazminat kasası hareketleri">
      <div className="st-panel-head">
        <h2 className="st-panel-title">Hareketler</h2>
      </div>

      {movements.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-title">Henüz hareket yok</span>
          <span className="st-empty-body">Kasa Defteri sayfasından yapılan aktarımlar burada listelenir.</span>
        </div>
      ) : (
        <ul className="st-movements">
          {movements.map((movement) => (
            <MovementItem key={movement.key} movement={movement} onCancel={() => onCancelPayout(movement)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Staff() {
  const session = useSession();
  const building = useCurrentBuilding();
  const { overview, errorMessage, reload } = useStaff(building.id);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  // null while adding a new employee.
  const [editedEmployee, setEditedEmployee] = useState(null);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const openEmployeeModal = (employee) => {
    setEditedEmployee(employee);
    setIsEmployeeModalOpen(true);
  };

  // Reports whether the payout was cancelled, so the reason box stays open when the service refuses.
  const cancelPayout = async (reason) => {
    try {
      const res = await window.electronAPI.cancelSeverancePayout({
        buildingId: building.id,
        payoutId: cancelTarget.id,
        userId: session.id,
        reason,
      });
      if (res.success) {
        showDialog.toast(res.message);
        setCancelTarget(null);
        reload();
        return true;
      }
      showDialog.error("Hata", res.message);
    } catch (err) {
      console.error("[Staff] cancelSeverancePayout:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    return false;
  };

  const renderBody = () => {
    if (errorMessage) {
      return <ErrorPanel title="Personel bilgileri okunamadı" body={errorMessage} onRetry={reload} />;
    }

    const hasFund = Boolean(overview.fund);

    return (
      <>
        {hasFund ? <SummaryStrip totals={overview.totals} /> : <FundStartForm building={building} onStarted={reload} />}

        <section className="page-band st-split-band" aria-label="Çalışanlar ve hareketler">
          <div className={hasFund ? "st-split" : "st-split st-split--single"}>
            <EmployeesPanel
              employees={overview.employees}
              onAdd={() => openEmployeeModal(null)}
              onDetail={setDetailTarget}
            />
            {hasFund ? <MovementsPanel movements={overview.movements} onCancelPayout={setCancelTarget} /> : null}
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="staff-container">
      <PageHeader title="Personel" />

      {renderBody()}

      {detailTarget && (
        <EmployeeDetailModal
          employee={detailTarget}
          building={building}
          canPay={Boolean(overview?.fund)}
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

      {isEmployeeModalOpen && (
        <EmployeeFormModal
          building={building}
          employee={editedEmployee}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSaved={() => {
            setIsEmployeeModalOpen(false);
            reload();
          }}
        />
      )}

      {payoutTarget && overview?.fund && (
        <SeverancePayoutModal
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

      {cancelTarget && (
        <CancelReasonModal
          title="Tazminat Ödemesini İptal Et"
          scope={`${cancelTarget.employee_name} · ${formatCurrency(cancelTarget.amount)}`}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancelPayout}
        />
      )}
    </div>
  );
}

export default Staff;

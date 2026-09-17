// Period summaries and the printed report. Not a list page: the rows belong to the dues page and the
// ledger, so the screen summarises and the row by row listing is in the saved file.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFileText,
  FiRefreshCw,
} from "react-icons/fi";
import "./Reports.css";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import { useIpcData } from "@/hooks/useIpcData";
import { useCurrentBuilding, useSession } from "@/hooks/useSession";
import { DUES_STATUS_LABELS, EMPTY_RESIDENT_LABEL, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { clampMonth, formatMonthYear, getCurrentMonth, getCurrentYear, getYearOptions, toPeriod } from "@/utils/date";
import { showDialog } from "@/utils/dialog";
import { buildReportHtml } from "./ReportsPdf/buildReportHtml";
import { categoryLabel, collectionRate, groupByCategory } from "./ReportsPdf/reportFigures";

// One table drives the pills, the arrow step, the document title and the file name, so they cannot differ.
const SCOPES = [
  {
    key: "month",
    label: "Aylık",
    stepUnit: "ay",
    exportNote: "Aylık rapor",
    title: (year, month) => formatMonthYear(year, month),
    fileSuffix: (year, month) => `${year}_${String(month).padStart(2, "0")}`,
  },
  {
    key: "year",
    label: "Yıllık",
    stepUnit: "yıl",
    exportNote: "Yıllık rapor",
    title: (year) => `${year} Yılı`,
    fileSuffix: (year) => `${year}`,
  },
  {
    key: "all",
    label: "Tüm Zamanlar",
    stepUnit: null,
    exportNote: "Binanın tüm kayıtları",
    title: () => "Tüm Zamanlar",
    fileSuffix: () => "tum_zamanlar",
  },
];

function useReport(buildingId, scope, year, month) {
  const [res, loadReport] = useIpcData("getReportData", { buildingId, scope, year, month });

  return {
    report: res.success ? res.data : null,
    errorMessage: res.success ? "" : res.message || "Rapor verileri alınamadı.",
    loadReport,
  };
}

function TotalCell({ tone, label, value, isBlank }) {
  return (
    <div className={`rp-total rp-total--${tone}`}>
      <span className="rp-total-label">{label}</span>
      <span className={isBlank ? "rp-total-value rp-total-value--blank" : "rp-total-value"}>
        {isBlank ? "—" : value}
      </span>
    </div>
  );
}

// Stays in place with three dashes when the read fails, so a screen carrying the navigation never empties.
function Totals({ report }) {
  const isBlank = !report;
  const income = report ? report.totalIncome : 0;
  const expense = report ? report.totalExpense : 0;

  return (
    <div className="rp-totals">
      <TotalCell tone="income" label="Gelir" value={formatSignedCurrency(income)} isBlank={isBlank} />
      <TotalCell tone="expense" label="Gider" value={formatSignedCurrency(-expense)} isBlank={isBlank} />
      <TotalCell tone="net" label="Net" value={formatSignedCurrency(income - expense)} isBlank={isBlank} />
    </div>
  );
}

function MissingNotice({ icon, tone, text }) {
  return (
    <div className="rp-miss-notice">
      <span className={`rp-miss-notice-mark rp-miss-notice-mark--${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

// Two empty states in two tones: no apartments at all, and every apartment paid. The status is coloured
// text rather than a chip, since the panel holds no other pill shape.
function MissingList({ dues }) {
  if (dues.length === 0) {
    return <MissingNotice icon={<FiCalendar />} tone="muted" text="Rapor edilecek daire bulunmuyor." />;
  }

  const missing = dues.filter((row) => row.status !== "paid");

  if (missing.length === 0) {
    return <MissingNotice icon={<FiCheckCircle />} tone="clear" text="Tüm daireler aidatını ödedi." />;
  }

  return (
    <div className="rp-miss-rows">
      {missing.map((row) => (
        <div className="rp-miss-row" key={row.apartment_id}>
          <span className="rp-miss-unit">Daire {row.apartment_no}</span>
          <span className={row.resident_name ? "rp-miss-name" : "rp-miss-name rp-miss-name--empty"}>
            {row.resident_name || EMPTY_RESIDENT_LABEL}
          </span>
          <span className={`rp-miss-status rp-miss-status--${row.status}`}>{DUES_STATUS_LABELS[row.status]}</span>
          <span className="rp-miss-amount">{formatCurrency(row.due_amount - row.paid_amount)}</span>
        </div>
      ))}
    </div>
  );
}

function CollectPanel({ report }) {
  const dues = report ? report.dues : [];
  const hasDues = dues.length > 0;
  const rate = report ? collectionRate(report.totalDue, report.totalPaid) : null;
  const paidCount = dues.filter((row) => row.status === "paid").length;
  const missingCount = dues.length - paidCount;

  return (
    <section className="rp-panel rp-panel--collect" aria-label="Aidat tahsilatı">
      <span className="rp-panel-title">Aidat Tahsilatı</span>

      <div className="rp-collect-head">
        <span className={rate === null ? "rp-collect-rate rp-collect-rate--blank" : "rp-collect-rate"}>
          {rate === null ? "—" : `%${rate}`}
        </span>
        <div className="rp-collect-bars">
          <span className={rate === null ? "rp-collect-meter rp-collect-meter--blank" : "rp-collect-meter"}>
            <i style={{ width: `${rate ?? 0}%` }} />
          </span>
          <span className="rp-collect-note">
            {hasDues ? (
              <>
                <b>{formatCurrency(report.totalPaid)}</b> tahsil edildi, {dues.length} daireden {paidCount} tanesi
                tamamını ödedi.
              </>
            ) : (
              "Tahakkuk etmiş aidat yok."
            )}
          </span>
        </div>
      </div>

      <div className="rp-miss">
        <div className="rp-miss-head">
          <span className="rp-miss-title">Ödemesi eksik daireler{missingCount > 0 ? ` (${missingCount})` : ""}</span>
          {missingCount > 0 && <span className="rp-miss-amount-label">Kalan</span>}
        </div>
        <MissingList dues={dues} />
      </div>
    </section>
  );
}

function BarGroup({ label, rows, total, tone, emptyLabel }) {
  return (
    <div className="rp-dist-group">
      <span className="rp-dist-label">{label}</span>
      {rows.length === 0 ? (
        <p className="rp-dist-empty">{emptyLabel}</p>
      ) : (
        <div className="rp-dist-rows">
          {rows.map((row) => (
            <div className={`rp-bar-row rp-bar-row--${tone}`} key={row.category}>
              <span className="rp-bar-fill" style={{ width: `${total > 0 ? (row.amount / total) * 100 : 0}%` }} />
              <span className="rp-bar-name">{categoryLabel(row.category)}</span>
              <span className="rp-bar-amount">{formatCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Grouped here, since the service already returns the rows. The share is the row fill, not a column.
function DistributionPanel({ report }) {
  const incomeRows = useMemo(() => (report ? groupByCategory(report.incomes) : []), [report]);
  const expenseRows = useMemo(() => (report ? groupByCategory(report.expenses) : []), [report]);

  return (
    <section className="rp-panel rp-panel--dist" aria-label="Gelir ve gider dağılımı">
      <span className="rp-panel-title">Dağılım</span>
      <div className="rp-dist">
        <BarGroup
          label="Gelir"
          rows={incomeRows}
          total={report ? report.totalIncome : 0}
          tone="income"
          emptyLabel="Gelir kaydı yok."
        />
        <BarGroup
          label="Gider"
          rows={expenseRows}
          total={report ? report.totalExpense : 0}
          tone="expense"
          emptyLabel="Gider kaydı yok."
        />
      </div>
    </section>
  );
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="rp-error" role="alert">
      <span className="rp-error-mark" aria-hidden="true">
        <FiAlertTriangle />
      </span>
      <span className="rp-error-text">
        <span className="rp-error-title">Rapor okunamadı</span>
        <span className="rp-error-body">{message}</span>
      </span>
      <button type="button" className="rp-error-action" onClick={onRetry}>
        <FiRefreshCw />
        Yeniden Dene
      </button>
    </div>
  );
}

// The arrows step by the scope's unit and stop at the selector's bounds, the real limit is in the handler.
// A field the scope ignores is disabled rather than hidden, so the bar keeps its shape.
function PeriodStepper({ scope, year, month, onChange }) {
  const isMonthly = scope.key === "month";
  const isYearly = scope.key === "year";
  const minYear = Math.min(...getYearOptions());
  const currentYear = getCurrentYear();
  const period = toPeriod(year, month);

  const canGoBack = isMonthly ? period > toPeriod(minYear, 1) : isYearly && year > minYear;
  const canGoForward = isMonthly ? period < toPeriod(currentYear, getCurrentMonth()) : isYearly && year < currentYear;

  const unit = scope.stepUnit ?? "dönem";
  const backLabel = `Önceki ${unit}`;
  const forwardLabel = `Sonraki ${unit}`;

  const step = (direction) => {
    if (isMonthly) {
      const monthIndex = period - 1 + direction;
      onChange(Math.floor(monthIndex / 12), (monthIndex % 12) + 1);
    } else {
      onChange(year + direction, month);
    }
  };

  return (
    <div className="rp-stepper">
      <button
        type="button"
        className="rp-step-btn"
        onClick={() => step(-1)}
        disabled={!canGoBack}
        aria-label={backLabel}
        title={backLabel}
      >
        <FiChevronLeft aria-hidden="true" />
      </button>

      <PeriodSelector
        year={year}
        month={month}
        onYearChange={(nextYear) => onChange(nextYear, month)}
        onMonthChange={(nextMonth) => onChange(year, nextMonth)}
        isMonthDisabled={!isMonthly}
        isYearDisabled={!isMonthly && !isYearly}
      />

      <button
        type="button"
        className="rp-step-btn"
        onClick={() => step(1)}
        disabled={!canGoForward}
        aria-label={forwardLabel}
        title={forwardLabel}
      >
        <FiChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

// Offers all three reports regardless of the view, so nobody switches scope to see what a download holds.
// Same stance as the account menu: no ARIA menu role, and Escape hands focus back to the trigger.
function ExportMenu({ year, month, isExporting, onExport }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (scope) => {
    setIsOpen(false);
    onExport(scope);
  };

  return (
    <div className="rp-export" ref={wrapperRef}>
      <button
        type="button"
        className="rp-export-trigger"
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        disabled={isExporting}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-busy={isExporting}
      >
        <FiDownload aria-hidden="true" />
        PDF İndir
        <FiChevronDown className={isOpen ? "rp-export-caret rp-export-caret--open" : "rp-export-caret"} />
      </button>

      {isOpen && (
        <div className="rp-export-panel">
          {SCOPES.map((scope) => (
            <button key={scope.key} type="button" className="rp-export-item" onClick={() => handleSelect(scope)}>
              <FiFileText aria-hidden="true" />
              <span className="rp-export-item-text">
                <span className="rp-export-item-title">{scope.title(year, month)}</span>
                <span className="rp-export-item-note">{scope.exportNote}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reports() {
  const building = useCurrentBuilding();
  const session = useSession();

  const [selectedScope, setSelectedScope] = useState("month");
  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [isExporting, setIsExporting] = useState(false);

  const { report, errorMessage, loadReport } = useReport(building.id, selectedScope, selectedYear, selectedMonth);

  const changePeriod = (year, month) => {
    setSelectedYear(year);
    setSelectedMonth(clampMonth(year, month));
  };

  const saveReport = async (data, scope) => {
    try {
      const html = buildReportHtml({
        data,
        scope,
        year: selectedYear,
        month: selectedMonth,
        buildingName: building.name,
        managerName: session.managerName,
      });
      const filename = `rapor_${scope.fileSuffix(selectedYear, selectedMonth)}.pdf`;
      const res = await window.electronAPI.saveReportFile({ filename, html });
      if (res.success) {
        showDialog.toast("Rapor Kaydedildi", res.message);
      } else if (!res.cancelled) {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Reports] saveReportFile:", err);
      showDialog.error("Hata", "PDF oluşturulurken bir hata oluştu.");
    }
  };

  // Each entry re-reads its own scope, since the menu offers scopes the view is not showing.
  const handleExport = async (scope) => {
    setIsExporting(true);
    try {
      const res = await window.electronAPI.getReportData({
        buildingId: building.id,
        scope: scope.key,
        year: selectedYear,
        month: selectedMonth,
      });
      if (res.success) {
        await saveReport(res.data, scope);
      } else {
        showDialog.error("Hata", res.message || "Rapor verileri alınamadı.");
      }
    } catch (err) {
      console.error("[Reports] getReportData:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    setIsExporting(false);
  };

  return (
    <div className="reports-container">
      <PageHeader title="Raporlar" />

      <section className="page-band rp-control-row" aria-label="Rapor türü ve dışa aktarma">
        <div className="rp-scope" role="group" aria-label="Ekrandaki rapor türü">
          {SCOPES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === selectedScope ? "rp-scope-btn rp-scope-btn--active" : "rp-scope-btn"}
              onClick={() => setSelectedScope(item.key)}
              aria-pressed={item.key === selectedScope}
            >
              {item.label}
            </button>
          ))}
        </div>

        <PeriodStepper
          scope={SCOPES.find((item) => item.key === selectedScope)}
          year={selectedYear}
          month={selectedMonth}
          onChange={changePeriod}
        />

        <ExportMenu year={selectedYear} month={selectedMonth} isExporting={isExporting} onExport={handleExport} />
      </section>

      <section className="page-band" aria-label="Rapor özeti">
        <div className="rp-sheet">
          <Totals report={report} />

          {errorMessage ? (
            <ErrorPanel message={errorMessage} onRetry={loadReport} />
          ) : (
            <div className="rp-panels">
              <CollectPanel report={report} />
              <DistributionPanel report={report} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Reports;

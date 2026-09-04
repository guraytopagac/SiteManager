import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Reports.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import {
  formatMonthYear,
  formatDate,
  getCurrentYear,
  getCurrentMonth,
  getYearOptions,
  getMonthOptions,
  clampMonth,
} from "@/utils/date";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";

const DUE_STATUS_LABELS = { paid: "Ödendi", partial: "Kısmi", unpaid: "Ödenmedi" };

const fmt = formatCurrency;

const PDF_TEXT_MAP = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
  "₺": "TL",
  "—": "-",
  "–": "-",
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "…": "...",
};

const PDF_MAPPED_CHARS = /[çÇğĞıİöÖşŞüÜ₺—–’‘“”…]/g;
const PDF_UNSUPPORTED_CHARS = /[^\n\x20-\xFF]/g;

const toPdfText = (value) =>
  String(value ?? "")
    .replace(PDF_MAPPED_CHARS, (char) => PDF_TEXT_MAP[char])
    .replace(PDF_UNSUPPORTED_CHARS, "?");

const toPdfRow = (cells) => cells.map(toPdfText);

function buildFinanceRows(data) {
  return [
    ...data.incomes.map((r) => ({ ...r, rowType: "income" })),
    ...data.expenses.map((r) => ({ ...r, rowType: "expense" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

function Reports() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();

  const [year, setYear] = useState(() => getCurrentYear());
  const [month, setMonth] = useState(() => getCurrentMonth());
  const [reportData, setReportData] = useState(null);
  const [loadedPeriod, setLoadedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("finance");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchReport = useCallback(
    async (selectedYear, selectedMonth) => {
      if (!building?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await window.electronAPI.getReportData({
          buildingId: building.id,
          year: selectedYear,
          month: selectedMonth,
        });
        if (!isMountedRef.current) return;
        if (response.success) {
          setReportData(response.data);
          setLoadedPeriod({ year: selectedYear, month: selectedMonth });
          setActiveTab("finance");
        } else {
          showAlert.error("Hata", response.message || "Rapor verileri alınamadı.");
        }
      } catch {
        if (isMountedRef.current) showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [building],
  );

  useEffect(() => {
    (async () => {
      await fetchReport(getCurrentYear(), getCurrentMonth());
    })();
  }, [fetchReport]);

  const handleYearChange = (selectedYear) => {
    setYear(selectedYear);
    setMonth((prev) => clampMonth(selectedYear, prev));
  };

  const collectionRate =
    reportData && reportData.totalDue > 0 ? Math.round((reportData.totalPaid / reportData.totalDue) * 100) : null;

  const financeRows = useMemo(() => (reportData ? buildFinanceRows(reportData) : []), [reportData]);

  const buildPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const buildingName = building?.name || "Mavikent Site Yönetimi";
    const period = loadedPeriod ?? { year, month };
    const title = `${buildingName} ${formatMonthYear(period.year, period.month)} Raporu`;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(toPdfText(title), pageW / 2, 18, { align: "center" });
    doc.setDrawColor(180, 180, 180);
    doc.line(14, 22, pageW - 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(toPdfText("Özet"), 14, 30);
    autoTable(doc, {
      startY: 33,
      head: [toPdfRow(["Toplam Gelir", "Toplam Gider", "Net Kasa", "Aidat Tahsilat"])],
      body: [
        toPdfRow([
          fmt(reportData.totalIncome),
          fmt(reportData.totalExpense),
          fmt(reportData.totalIncome - reportData.totalExpense),
          collectionRate === null ? "—" : `%${collectionRate}`,
        ]),
      ],
      styles: { fontSize: 9, halign: "center" },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14, right: 14 },
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(toPdfText("Gelir / Gider Detayı"), 14, doc.lastAutoTable.finalY + 10);

    const pdfFinanceRows = financeRows.map((r) =>
      toPdfRow([
        r.date,
        r.rowType === "income" ? "Gelir" : "Gider",
        r.description,
        formatSignedCurrency(r.rowType === "income" ? r.amount : -r.amount),
      ]),
    );

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 13,
      head: [toPdfRow(["Tarih", "Tür", "Açıklama", "Tutar"])],
      body: pdfFinanceRows.length > 0 ? pdfFinanceRows : [toPdfRow(["—", "—", "Bu ay için kayıt bulunamadı.", "—"])],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(toPdfText("Aidat Tahsilat Durumu"), 14, 18);

    autoTable(doc, {
      startY: 22,
      head: [toPdfRow(["Daire No", "Kat", "Tip", "Sakin", "Aidat", "Ödenen", "Durum"])],
      body:
        reportData.dues.length > 0
          ? reportData.dues.map((d) =>
              toPdfRow([
                d.apartment_no,
                d.floor,
                d.type,
                d.resident_name || "—",
                fmt(d.due_amount),
                fmt(d.paid_amount),
                DUE_STATUS_LABELS[d.status] || d.status,
              ]),
            )
          : [toPdfRow(["—", "—", "—", "Bu ay için aidat kaydı bulunamadı.", "—", "—", "—"])],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    return doc.output("arraybuffer");
  };

  const handleExportPdf = async () => {
    try {
      const buffer = buildPdf();
      const period = loadedPeriod ?? { year, month };
      const filename = `rapor_${period.year}_${String(period.month).padStart(2, "0")}.pdf`;
      const response = await window.electronAPI.saveReportFile({ filename, buffer: new Uint8Array(buffer) });
      if (response.success) {
        showAlert.toast("Kaydedildi", response.message);
      } else if (!response.cancelled) {
        showAlert.error("Hata", response.message);
      }
    } catch (err) {
      showAlert.error("Hata", "PDF oluşturulurken bir hata oluştu.");
      console.error(err);
    }
  };

  return (
    <div className="reports-container">
      <div className="account-menu-row">
        <AccountMenu />
      </div>

      <div className="reports-header">
        <h2>Raporlar</h2>
      </div>

      <div className="period-selector">
        <div className="period-controls">
          <div className="select-group">
            <label>Yıl</label>
            <select value={year} onChange={(e) => handleYearChange(Number(e.target.value))}>
              {getYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="select-group">
            <label>Ay</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {getMonthOptions(year).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="button button-primary"
            onClick={() => fetchReport(year, month)}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Yükleniyor..." : "Raporu Göster"}
          </button>
        </div>

        {reportData && (
          <div className="export-buttons">
            <button className="button button-pdf" onClick={handleExportPdf}>
              PDF İndir
            </button>
          </div>
        )}
      </div>

      {reportData && (
        <>
          {loadedPeriod && (
            <p className="report-period-label">{formatMonthYear(loadedPeriod.year, loadedPeriod.month)} raporu</p>
          )}
          <div className="report-summary">
            <div className="summary-card income">
              <span className="summary-label">Toplam Gelir</span>
              <span className="summary-amount">{fmt(reportData.totalIncome)}</span>
            </div>
            <div className="summary-card expense">
              <span className="summary-label">Toplam Gider</span>
              <span className="summary-amount">{fmt(reportData.totalExpense)}</span>
            </div>
            <div
              className={`summary-card net ${reportData.totalIncome - reportData.totalExpense >= 0 ? "positive" : "negative"}`}
            >
              <span className="summary-label">Net Kasa</span>
              <span className="summary-amount">{fmt(reportData.totalIncome - reportData.totalExpense)}</span>
            </div>
            <div className="summary-card collection">
              <span className="summary-label">Aidat Tahsilat</span>
              <span className="summary-amount">{collectionRate === null ? "—" : `%${collectionRate}`}</span>
            </div>
          </div>

          <div className="report-tabs">
            <button
              className={`report-tab ${activeTab === "finance" ? "active" : ""}`}
              onClick={() => setActiveTab("finance")}
            >
              Gelir / Gider ({reportData.incomes.length + reportData.expenses.length})
            </button>
            <button
              className={`report-tab ${activeTab === "dues" ? "active" : ""}`}
              onClick={() => setActiveTab("dues")}
            >
              Aidat Tahsilat ({reportData.dues.length})
            </button>
          </div>

          {activeTab === "finance" && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th>Açıklama</th>
                  <th className="amount-header">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {reportData.incomes.length === 0 && reportData.expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      Bu ay için kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  financeRows.map((r) => (
                    <tr key={`${r.rowType}-${r.id}`}>
                      <td className="date-cell">{formatDate(r.date)}</td>
                      <td>
                        <span className={`type-badge type-${r.rowType}`}>
                          {r.rowType === "income" ? "Gelir" : "Gider"}
                        </span>
                      </td>
                      <td>{r.description}</td>
                      <td className={`amount-cell amount-${r.rowType}`}>
                        {formatSignedCurrency(r.rowType === "income" ? r.amount : -r.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "dues" && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Daire No</th>
                  <th>Kat</th>
                  <th>Tip</th>
                  <th>Sakin</th>
                  <th className="amount-header">Aidat</th>
                  <th className="amount-header">Ödenen</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {reportData.dues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      Bu ay için aidat kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  reportData.dues.map((d) => (
                    <tr key={d.apartment_id}>
                      <td>{d.apartment_no}</td>
                      <td>{d.floor}</td>
                      <td>{d.type}</td>
                      <td>{d.resident_name || "—"}</td>
                      <td className="amount-cell">{fmt(d.due_amount)}</td>
                      <td className="amount-cell">{fmt(d.paid_amount)}</td>
                      <td>
                        <span className={`status-badge status-${d.status}`}>
                          {DUE_STATUS_LABELS[d.status] || d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      {!reportData && !loading && (
        <div className="reports-empty">
          <p>Rapor verisi yüklenemedi. Bir dönem seçip "Raporu Göster" butonuna tıklayın.</p>
        </div>
      )}

      <hr className="reports-divider" />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button button-back">
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Reports;

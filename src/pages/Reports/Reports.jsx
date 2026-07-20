import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Reports.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";
import { MONTHS, formatMonthYear, getCurrentYear, getCurrentMonth } from "@/utils/date";

const DUE_STATUS_LABELS = { paid: "Ödendi", partial: "Kısmi", unpaid: "Ödenmedi" };

const currentYear = getCurrentYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function fmt(amount) {
  return Number(amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

function buildFinanceRows(data) {
  return [
    ...data.incomes.map((r) => ({ ...r, rowType: "income" })),
    ...data.expenses.map((r) => ({ ...r, rowType: "expense" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

function Reports() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [year, setYear] = useState(() => getCurrentYear());
  const [month, setMonth] = useState(() => getCurrentMonth());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("finance");

  const fetchReport = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const response = await window.electronAPI.getReportData(currentUser.id, year, month);
      if (response.success) {
        setReportData(response.data);
        setActiveTab("finance");
      } else {
        showAlert.error("Hata", response.message || "Rapor verileri alınamadı.");
      }
    } catch {
      showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const collectionRate =
    reportData && reportData.totalDue > 0 ? Math.round((reportData.totalPaid / reportData.totalDue) * 100) : 0;

  const financeRows = useMemo(() => (reportData ? buildFinanceRows(reportData) : []), [reportData]);

  const buildPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const title = `Mavikent Site Yönetimi ${formatMonthYear(year, month)} Raporu`;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, pageW / 2, 18, { align: "center" });
    doc.setDrawColor(180, 180, 180);
    doc.line(14, 22, pageW - 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Ozet", 14, 30);
    autoTable(doc, {
      startY: 33,
      head: [["Toplam Gelir", "Toplam Gider", "Net Kasa", "Aidat Tahsilat"]],
      body: [
        [
          fmt(reportData.totalIncome),
          fmt(reportData.totalExpense),
          fmt(reportData.totalIncome - reportData.totalExpense),
          reportData.totalDue > 0 ? `%${collectionRate}` : "—",
        ],
      ],
      styles: { fontSize: 9, halign: "center" },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14, right: 14 },
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Gelir / Gider Detayi", 14, doc.lastAutoTable.finalY + 10);

    const pdfFinanceRows = financeRows.map((r) => [
      r.date,
      r.rowType === "income" ? "Gelir" : "Gider",
      r.description,
      r.rowType === "income" ? fmt(r.amount) : `-${fmt(r.amount)}`,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 13,
      head: [["Tarih", "Tur", "Aciklama", "Tutar"]],
      body: pdfFinanceRows.length > 0 ? pdfFinanceRows : [["—", "—", "Bu ay icin kayit bulunamadi.", "—"]],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Aidat Tahsilat Durumu", 14, 18);

    autoTable(doc, {
      startY: 22,
      head: [["Daire No", "Kat", "Tip", "Sakin", "Aidat", "Odenen", "Durum"]],
      body:
        reportData.dues.length > 0
          ? reportData.dues.map((d) => [
              d.apartment_no,
              d.floor,
              d.type,
              d.resident_name || "—",
              fmt(d.due_amount),
              fmt(d.paid_amount),
              DUE_STATUS_LABELS[d.status] || d.status,
            ])
          : [["—", "—", "—", "Bu ay icin aidat kaydı bulunamadı.", "—", "—", "—"]],
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
      const filename = `rapor_${year}_${String(month).padStart(2, "0")}.pdf`;
      const response = await window.electronAPI.saveReportFile(filename, Array.from(new Uint8Array(buffer)));
      if (response.success) {
        showAlert.success("Kaydedildi", response.message);
      } else if (response.message !== "İptal edildi.") {
        showAlert.error("Hata", response.message);
      }
    } catch (err) {
      showAlert.error("Hata", "PDF oluşturulurken bir hata oluştu.");
      console.error(err);
    }
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Raporlar</h2>
      </div>

      <div className="period-selector">
        <div className="period-controls">
          <div className="select-group">
            <label>Yıl</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="select-group">
            <label>Ay</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button className="button button-primary" onClick={fetchReport} disabled={loading} aria-busy={loading}>
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
              <span className="summary-amount">%{collectionRate}</span>
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
                      <td className="date-cell">{r.date}</td>
                      <td>
                        <span className={`type-badge type-${r.rowType}`}>
                          {r.rowType === "income" ? "Gelir" : "Gider"}
                        </span>
                      </td>
                      <td>{r.description}</td>
                      <td className={`amount-cell amount-${r.rowType}`}>
                        {r.rowType === "income" ? "+" : "-"}
                        {fmt(r.amount)}
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
                    <tr key={`due-${d.apartment_no}-${d.floor}`}>
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
          <p>Bir dönem seçip "Raporu Göster" butonuna tıklayın.</p>
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

// The printed report, in a fixed order of sections. It never loads the application stylesheet and always
// prints on light paper, so its colours are literal. Page breaks are declared in its CSS.

import { DUES_STATUS_LABELS, EMPTY_RESIDENT_LABEL } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { formatDate, formatMonthYear, getCurrentMonth, getCurrentYear, getToday } from "@/utils/date";
import { floorLabel } from "@/utils/floorLabel";
import { categoryLabel, collectionRate, formatRate, groupByCategory } from "./reportFigures";

function buildFinanceRows(data) {
  return [
    ...data.incomes.map((r) => ({ ...r, rowType: "income" })),
    ...data.expenses.map((r) => ({ ...r, rowType: "expense" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

const balanceTone = (value) => (value < -0.005 ? "negative" : undefined);

const cellOf = (cell) => (cell !== null && typeof cell === "object" ? cell : { content: cell });

function PdfRow({ cells, right, className, isHead = false }) {
  const Cell = isHead ? "th" : "td";
  const rowCells = cells.map(cellOf);
  const columnIndexes = rowCells.map((_, index) =>
    rowCells.slice(0, index).reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0),
  );

  return (
    <tr className={className}>
      {rowCells.map((cell, index) => {
        const classes = [right.includes(columnIndexes[index]) ? "num" : null, cell.tone].filter(Boolean).join(" ");
        return (
          <Cell key={index} colSpan={cell.colSpan} className={classes || undefined}>
            {cell.content}
          </Cell>
        );
      })}
    </tr>
  );
}

function PdfTable({ head, rows, total, empty, right = [], widths = [], className }) {
  return (
    <table className={className}>
      {widths.length > 0 ? (
        <colgroup>
          {head.map((_, index) => (
            <col key={index} style={widths[index] ? { width: widths[index] } : undefined} />
          ))}
        </colgroup>
      ) : null}
      <thead>
        <PdfRow cells={head} right={right} isHead />
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="empty" colSpan={head.length}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((cells, index) => <PdfRow key={index} cells={cells} right={right} />)
        )}
        {rows.length > 0 && total ? <PdfRow cells={total} right={right} className="total" /> : null}
      </tbody>
    </table>
  );
}

function PdfSummary({ cells }) {
  return (
    <PdfTable
      className="summary"
      head={cells.map((cell) => cell.label)}
      rows={[cells.map((cell) => ({ content: cell.value, tone: cell.tone }))]}
    />
  );
}

function PdfSection({ title, keepTogether = false, children }) {
  return (
    <section className={keepTogether ? "keep" : undefined}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// Opens with the balance carried in, since a period report asks where the cash started and ended. An all
// time report has no opening balance.
function PdfCashSummary({ data }) {
  const net = data.totalIncome - data.totalExpense;
  const opening = data.openingBalance;
  const cells =
    opening === null
      ? [
          { label: "Toplam Gelir", value: formatSignedCurrency(data.totalIncome), tone: "positive" },
          { label: "Toplam Gider", value: formatSignedCurrency(-data.totalExpense), tone: "negative" },
          { label: "Kasa", value: formatCurrency(net), tone: balanceTone(net) },
        ]
      : [
          { label: "Devreden Kasa", value: formatCurrency(opening), tone: balanceTone(opening) },
          { label: "Dönem Geliri", value: formatSignedCurrency(data.totalIncome), tone: "positive" },
          { label: "Dönem Gideri", value: formatSignedCurrency(-data.totalExpense), tone: "negative" },
          { label: "Dönem Neti", value: formatSignedCurrency(net), tone: balanceTone(net) },
          { label: "Dönem Sonu Kasa", value: formatCurrency(opening + net), tone: balanceTone(opening + net) },
        ];

  // The whole ledger ends today, a dated range at its last day.
  const { cash, bank } = data.closingAccounts;
  const when = opening === null ? "Bugün" : "Dönem sonunda";

  return (
    <PdfSection title="Kasa Özeti" keepTogether>
      <PdfSummary cells={cells} />
      <p className="note">
        {when} kasanın {formatCurrency(cash)} tutarı elde nakit, {formatCurrency(bank)} tutarı bankadadır.
      </p>
    </PdfSection>
  );
}

// Only printed when the building has a fund. What entered the fund covers the monthly transfers, the
// top-ups and, in the range the fund was started, its opening balance.
function PdfSeveranceSummary({ severance }) {
  const cells = [
    ...(severance.startBalance === null
      ? []
      : [{ label: "Dönem Başı Bakiye", value: formatCurrency(severance.startBalance) }]),
    { label: "Kasaya Giren", value: formatSignedCurrency(severance.inflow), tone: "positive" },
    { label: "Ödenen Tazminat", value: formatSignedCurrency(-severance.paidOut), tone: "negative" },
    {
      label: severance.startBalance === null ? "Kasa Bakiyesi" : "Dönem Sonu Bakiye",
      value: formatCurrency(severance.endBalance),
    },
  ];

  return (
    <PdfSection title="Tazminat Kasası" keepTogether>
      <PdfSummary cells={cells} />
      <p className="note">
        Rapor tarihindeki tahmini tazminat yükümlülüğü {formatCurrency(severance.liability)}. Tazminat kasasına yapılan
        aktarımlar gider hareketlerinde yer alır, kasadan yapılan ödemeler ana kasanın toplamına girmez.
      </p>
    </PdfSection>
  );
}

function PdfDuesSummary({ data }) {
  const remaining = data.totalDue - data.totalPaid;
  const counts = { paid: 0, partial: 0, unpaid: 0 };
  data.dues.forEach((row) => {
    counts[row.status] += 1;
  });
  const statusParts = [
    [counts.paid, "tamamını ödedi"],
    [counts.partial, "kısmen ödedi"],
    [counts.unpaid, "hiç ödemedi"],
  ]
    .filter(([count]) => count > 0)
    .map(([count, text]) => `${count} tanesi ${text}`);

  return (
    <PdfSection title="Aidat Özeti" keepTogether>
      <PdfSummary
        cells={[
          { label: "Tahakkuk", value: formatCurrency(data.totalDue) },
          { label: "Tahsil Edilen", value: formatCurrency(data.totalPaid), tone: "positive" },
          { label: "Kalan", value: formatCurrency(remaining), tone: balanceTone(-remaining) },
          { label: "Tahsilat Oranı", value: formatRate(collectionRate(data.totalDue, data.totalPaid)) },
        ]}
      />
      <p className="note">
        {data.dues.length === 0
          ? "Bu dönemde tahakkuk etmiş aidat yok."
          : `${data.dues.length} daireden ${statusParts.join(", ")}.`}
      </p>
    </PdfSection>
  );
}

function PdfCategoryTable({ rows, total, head, empty }) {
  return (
    <PdfTable
      head={[head, "Tutar", "Pay"]}
      rows={rows.map((row) => [
        categoryLabel(row.category),
        formatCurrency(row.amount),
        formatRate(collectionRate(total, row.amount)),
      ])}
      total={["Toplam", formatCurrency(total), ""]}
      empty={empty}
      right={[1, 2]}
      widths={[null, null, "14mm"]}
    />
  );
}

function PdfDistribution({ data }) {
  return (
    <PdfSection title="Gelir ve Gider Dağılımı" keepTogether>
      <div className="split">
        <PdfCategoryTable
          rows={groupByCategory(data.incomes)}
          total={data.totalIncome}
          head="Gelir Kalemi"
          empty="Gelir kaydı yok."
        />
        <PdfCategoryTable
          rows={groupByCategory(data.expenses)}
          total={data.totalExpense}
          head="Gider Kalemi"
          empty="Gider kaydı yok."
        />
      </div>
    </PdfSection>
  );
}

function PdfMonthlyBreakdown({ data, year }) {
  const lastMonth = year === getCurrentYear() ? getCurrentMonth() : 12;
  const sumMonth = (rows, month) =>
    rows.filter((row) => Number(row.date.slice(5, 7)) === month).reduce((sum, row) => sum + row.amount, 0);

  const rows = Array.from({ length: lastMonth }, (_, index) => {
    const month = index + 1;
    const dues = data.monthlyDues.find((row) => row.month === month);
    const income = sumMonth(data.incomes, month);
    const expense = sumMonth(data.expenses, month);
    const due = dues ? dues.due_amount : 0;
    const paid = dues ? dues.paid_amount : 0;
    return [
      formatMonthYear(year, month),
      formatCurrency(income),
      formatCurrency(expense),
      { content: formatSignedCurrency(income - expense), tone: balanceTone(income - expense) },
      formatCurrency(due),
      formatCurrency(paid),
      formatRate(collectionRate(due, paid)),
    ];
  });

  return (
    <PdfSection title="Aylık Döküm">
      <PdfTable
        head={["Ay", "Gelir", "Gider", "Net", "Tahakkuk", "Tahsil Edilen", "Oran"]}
        rows={rows}
        total={[
          "Toplam",
          formatCurrency(data.totalIncome),
          formatCurrency(data.totalExpense),
          formatSignedCurrency(data.totalIncome - data.totalExpense),
          formatCurrency(data.monthlyDues.reduce((sum, row) => sum + row.due_amount, 0)),
          formatCurrency(data.monthlyDues.reduce((sum, row) => sum + row.paid_amount, 0)),
          "",
        ]}
        right={[1, 2, 3, 4, 5, 6]}
        widths={[null, null, null, null, null, null, "16mm"]}
      />
    </PdfSection>
  );
}

function PdfMovements({ data }) {
  const rows = buildFinanceRows(data);
  const isIncome = (row) => row.rowType === "income";

  return (
    <PdfSection title="Gelir ve Gider Hareketleri">
      <PdfTable
        head={["Tarih", "Tür", "Kategori", "Açıklama", "Tutar"]}
        rows={rows.map((row) => [
          formatDate(row.date),
          isIncome(row) ? "Gelir" : "Gider",
          categoryLabel(row.category),
          row.description || "—",
          {
            content: formatSignedCurrency(isIncome(row) ? row.amount : -row.amount),
            tone: isIncome(row) ? "positive" : "negative",
          },
        ])}
        total={[{ content: "Net", colSpan: 4 }, formatSignedCurrency(data.totalIncome - data.totalExpense)]}
        empty="Bu dönemde gelir veya gider kaydı yok."
        right={[4]}
        widths={["30mm", "16mm", "30mm", null, "32mm"]}
      />
    </PdfSection>
  );
}

function PdfDuesTable({ data }) {
  const remainingOf = (row) => row.due_amount - row.paid_amount;

  return (
    <PdfSection title="Daire Bazında Aidat Durumu">
      <PdfTable
        head={["Daire", "Kat", "Sakin", "Aidat", "Ödenen", "Kalan", "Durum"]}
        rows={data.dues.map((row) => [
          row.apartment_no,
          floorLabel(row.floor),
          row.resident_name || EMPTY_RESIDENT_LABEL,
          formatCurrency(row.due_amount),
          formatCurrency(row.paid_amount),
          { content: formatCurrency(remainingOf(row)), tone: balanceTone(-remainingOf(row)) },
          { content: DUES_STATUS_LABELS[row.status], tone: row.status },
        ])}
        total={[
          { content: "Toplam", colSpan: 3 },
          formatCurrency(data.totalDue),
          formatCurrency(data.totalPaid),
          formatCurrency(data.totalDue - data.totalPaid),
          formatRate(collectionRate(data.totalDue, data.totalPaid)),
        ]}
        empty="Aidat kaydı bulunamadı."
        right={[3, 4, 5]}
        widths={["15mm", "20mm", null, "27mm", "27mm", "27mm", "27mm"]}
      />
    </PdfSection>
  );
}

function ReportDocument({ data, year, title, buildingName, managerName }) {
  return (
    <>
      <header className="doc-head">
        <h1>{buildingName}</h1>
        <div className="doc-meta">
          <span>{title}</span>
          <span className="doc-date">Oluşturulma: {formatDate(getToday())}</span>
        </div>
      </header>
      <PdfCashSummary data={data} />
      {data.severance ? <PdfSeveranceSummary severance={data.severance} /> : null}
      <PdfDuesSummary data={data} />
      <PdfDistribution data={data} />
      {data.monthlyDues ? <PdfMonthlyBreakdown data={data} year={year} /> : null}
      <PdfMovements data={data} />
      <PdfDuesTable data={data} />
      <div className="signature">
        <span className="signature-role">Site Yöneticisi</span>
        <strong className="signature-name">{managerName}</strong>
        <div className="signature-line">İmza</div>
      </div>
    </>
  );
}

export default ReportDocument;

// The printed report, in a fixed order of sections. It never loads the application stylesheet and always
// prints on light paper, so its colours are literal. Page breaks are declared in its CSS.

import { CASH_ACCOUNT_LABELS, DUES_STATUS_LABELS, EMPTY_RESIDENT_LABEL } from "@/utils/constants";
import { formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { formatDate, formatMonthYear, getToday } from "@/utils/date";
import { floorLabel } from "@/utils/floorLabel";
import {
  bankSign,
  buildBankRows,
  buildFinanceRows,
  buildMonthlyFigures,
  categoryLabel,
  collectionRate,
  formatRate,
  groupByCategory,
} from "./reportFigures";

const ACCOUNT_KEYS = ["cash", "bank"];

const balanceTone = (value) => (value < -0.005 ? "negative" : undefined);

const sumAccounts = (part) => part.cash + part.bank;

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

// A row is either a list of cells or a { band } object, which opens a month across the full width.
function PdfTable({ head, rows, totals = [], empty, right = [], widths = [], className }) {
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
          rows.map((row, index) =>
            Array.isArray(row) ? (
              <PdfRow key={index} cells={row} right={right} />
            ) : (
              <tr key={index} className="band">
                <td colSpan={head.length}>{row.band}</td>
              </tr>
            ),
          )
        )}
        {rows.length > 0
          ? totals.map((cells, index) => (
              <PdfRow key={`total-${index}`} cells={cells} right={right} className="total" />
            ))
          : null}
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

// A short section is kept whole and moves to the next page when it does not fit. A long table starts on a
// page of its own instead, so it never opens with a few rows at the foot of the previous one.
function PdfSection({ title, keepTogether = false, newPage = false, children }) {
  const className = [keepTogether ? "keep" : null, newPage ? "new-page" : null].filter(Boolean).join(" ");
  return (
    <section className={className || undefined}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const monthOf = (row) => row.date.slice(0, 7);

// A long range lists the same kind of row for many pages, so a band opens every month. A range of a single
// month has nothing to tell apart and gets none.
function withMonthBands(rows, toCells) {
  const isSpread = new Set(rows.map(monthOf)).size > 1;
  return rows.flatMap((row, index) => {
    const cells = toCells(row);
    if (!isSpread || (index > 0 && monthOf(rows[index - 1]) === monthOf(row))) return [cells];
    const band = formatMonthYear(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)));
    return [{ band }, cells];
  });
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

  return (
    <PdfSection title="Kasa Özeti" keepTogether>
      <PdfSummary cells={cells} />
      <PdfAccountFlow accounts={data.accounts} />
    </PdfSection>
  );
}

// The same cash, followed account by account, so every row reads opening + income - expense + transfer =
// closing. A transfer keeps its sign but no tone: it neither earns nor spends, it only moves the split, and
// its column is dropped when the range holds none. The whole ledger has no opening, so that column goes too.
function PdfAccountFlow({ accounts }) {
  const { opening, income, expense, transfer, closing } = accounts;
  const hasTransfers = transfer.cash !== 0 || transfer.bank !== 0;

  const head = [
    "Hesap",
    ...(opening ? ["Dönem Başı"] : []),
    "Giren",
    "Çıkan",
    ...(hasTransfers ? ["Aktarım"] : []),
    opening ? "Dönem Sonu" : "Kasa",
  ];

  const cellsOf = (openingValue, incomeValue, expenseValue, transferValue, closingValue) => [
    ...(opening ? [{ content: formatCurrency(openingValue), tone: balanceTone(openingValue) }] : []),
    { content: formatSignedCurrency(incomeValue), tone: "positive" },
    { content: formatSignedCurrency(-expenseValue), tone: "negative" },
    ...(hasTransfers ? [formatSignedCurrency(transferValue)] : []),
    { content: formatCurrency(closingValue), tone: balanceTone(closingValue) },
  ];

  return (
    <PdfTable
      className="flow"
      head={head}
      rows={ACCOUNT_KEYS.map((key) => [
        CASH_ACCOUNT_LABELS[key],
        ...cellsOf(opening?.[key], income[key], expense[key], transfer[key], closing[key]),
      ])}
      totals={[
        [
          "Toplam",
          ...cellsOf(
            opening ? sumAccounts(opening) : null,
            sumAccounts(income),
            sumAccounts(expense),
            sumAccounts(transfer),
            sumAccounts(closing),
          ),
        ],
      ]}
      right={head.map((_, index) => index).slice(1)}
      widths={["30mm"]}
    />
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

// Only printed when the building has a fund. The four cells follow the money, the note follows the charge:
// a contribution raised this period may be paid in the next one, so the two lines answer different questions.
function PdfInvestmentSummary({ investment }) {
  const cells = [
    ...(investment.startBalance === null
      ? []
      : [{ label: "Dönem Başı Bakiye", value: formatCurrency(investment.startBalance) }]),
    { label: "Fona Giren", value: formatSignedCurrency(investment.inflow), tone: "positive" },
    { label: "Fondan Harcanan", value: formatSignedCurrency(-investment.spent), tone: "negative" },
    {
      label: investment.startBalance === null ? "Fon Bakiyesi" : "Dönem Sonu Bakiye",
      value: formatCurrency(investment.endBalance),
    },
  ];

  return (
    <PdfSection title="Yatırım Aidatı" keepTogether>
      <PdfSummary cells={cells} />
      <p className="note">
        {investment.accrued === 0
          ? "Bu dönemde tahakkuk etmiş yatırım aidatı yok."
          : `Bu dönemin yatırım aidatı tahakkuku ${formatCurrency(investment.accrued)}, tahsil edilen ${formatCurrency(
              investment.collected,
            )} (${formatRate(collectionRate(investment.accrued, investment.collected))}).`}{" "}
        Yatırım aidatı tahsilatları gelir hareketlerinde, fondan yapılan harcamalar gider hareketlerinde yer alır.
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
      totals={[["Toplam", formatCurrency(total), ""]]}
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
  const rows = buildMonthlyFigures(data, year).map(({ month, income, expense, due, paid }) => [
    formatMonthYear(year, month),
    formatCurrency(income),
    formatCurrency(expense),
    { content: formatSignedCurrency(income - expense), tone: balanceTone(income - expense) },
    formatCurrency(due),
    formatCurrency(paid),
    formatRate(collectionRate(due, paid)),
  ]);

  return (
    <PdfSection title="Aylık Döküm" keepTogether>
      <PdfTable
        head={["Ay", "Gelir", "Gider", "Net", "Tahakkuk", "Tahsil Edilen", "Oran"]}
        rows={rows}
        totals={[
          [
            "Toplam",
            formatCurrency(data.totalIncome),
            formatCurrency(data.totalExpense),
            formatSignedCurrency(data.totalIncome - data.totalExpense),
            formatCurrency(data.monthlyDues.reduce((sum, row) => sum + row.due_amount, 0)),
            formatCurrency(data.monthlyDues.reduce((sum, row) => sum + row.paid_amount, 0)),
            "",
          ],
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
    <PdfSection title="Gelir ve Gider Hareketleri" newPage>
      <PdfTable
        head={["Tarih", "Tür", "Hesap", "Kategori", "Açıklama", "Tutar"]}
        rows={withMonthBands(rows, (row) => [
          formatDate(row.date),
          isIncome(row) ? "Gelir" : "Gider",
          CASH_ACCOUNT_LABELS[row.account],
          categoryLabel(row.category),
          row.description || "—",
          {
            content: formatSignedCurrency(isIncome(row) ? row.amount : -row.amount),
            tone: isIncome(row) ? "positive" : "negative",
          },
        ])}
        totals={[[{ content: "Net", colSpan: 5 }, formatSignedCurrency(data.totalIncome - data.totalExpense)]]}
        empty="Bu dönemde gelir veya gider kaydı yok."
        right={[5]}
        widths={["30mm", "15mm", "16mm", "28mm", null, "32mm"]}
      />
    </PdfSection>
  );
}

const BANK_ROW_TYPES = {
  income: { label: "Gelir", tone: "positive" },
  expense: { label: "Gider", tone: "negative" },
  transfer: { label: "Aktarım" },
};

// A transfer carries no tone, as in the account flow, so the net row equals the bank line of that table.
function PdfBankMovements({ data }) {
  const rows = buildBankRows(data);
  const hasTransfers = data.transfers.length > 0;
  const { income, expense, transfer } = data.accounts;
  const net = income.bank - expense.bank + transfer.bank;

  const cellsOf = (row) => {
    const type = BANK_ROW_TYPES[row.rowType];
    return [
      formatDate(row.date),
      type.label,
      categoryLabel(row.category),
      row.description || "—",
      { content: formatSignedCurrency(bankSign(row) * row.amount), tone: type.tone },
    ];
  };

  return (
    <PdfSection title="Banka Hareketleri" newPage>
      <PdfTable
        head={["Tarih", "Tür", "Kategori", "Açıklama", "Tutar"]}
        rows={withMonthBands(rows, cellsOf)}
        totals={[
          [
            { content: "Toplam Gelir", colSpan: 4 },
            { content: formatSignedCurrency(income.bank), tone: "positive" },
          ],
          [
            { content: "Toplam Gider", colSpan: 4 },
            { content: formatSignedCurrency(-expense.bank), tone: "negative" },
          ],
          ...(hasTransfers ? [[{ content: "Aktarım", colSpan: 4 }, formatSignedCurrency(transfer.bank)]] : []),
          [
            { content: "Net", colSpan: 4 },
            { content: formatSignedCurrency(net), tone: balanceTone(net) },
          ],
        ]}
        empty="Bu dönemde banka hesabına ait hareket yok."
        right={[4]}
        widths={["30mm", "17mm", "30mm", null, "32mm"]}
      />
    </PdfSection>
  );
}

function PdfDuesTable({ data }) {
  const remainingOf = (row) => row.due_amount - row.paid_amount;

  return (
    <PdfSection title="Daire Bazında Aidat Durumu" newPage>
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
        totals={[
          [
            { content: "Toplam", colSpan: 3 },
            formatCurrency(data.totalDue),
            formatCurrency(data.totalPaid),
            formatCurrency(data.totalDue - data.totalPaid),
            formatRate(collectionRate(data.totalDue, data.totalPaid)),
          ],
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
      {data.investment ? <PdfInvestmentSummary investment={data.investment} /> : null}
      <PdfDuesSummary data={data} />
      <PdfDistribution data={data} />
      {data.monthlyDues ? <PdfMonthlyBreakdown data={data} year={year} /> : null}
      <PdfMovements data={data} />
      <PdfBankMovements data={data} />
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

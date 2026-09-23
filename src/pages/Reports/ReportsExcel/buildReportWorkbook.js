// The saved report as a workbook, one sheet per part of the printed report. Labels and figures come from the
// same sources as the PDF. Amounts and dates are real cells so the file can be sorted and filtered, and totals
// are written as values rather than formulas, so an edited row never moves them away from the app's figures.

import ExcelJS from "exceljs/dist/exceljs.bare.min.js";
import {
  bankSign,
  buildBankRows,
  buildFinanceRows,
  buildMonthlyFigures,
  categoryLabel,
  groupByCategory,
} from "@/pages/Reports/ReportsPdf/reportFigures";
import { CASH_ACCOUNT_LABELS, DUES_STATUS_LABELS, EMPTY_RESIDENT_LABEL } from "@/utils/constants";
import { formatDate, formatMonthYear, getToday } from "@/utils/date";
import { floorLabel } from "@/utils/floorLabel";

const MONEY = '#,##0.00 "₺"';
const SIGNED_MONEY = '#,##0.00 "₺";[Red]-#,##0.00 "₺"';
const RATE = "0%";
// The locale tag makes Excel print Turkish month names, the single date format the app shows.
const DATE = "[$-41F]d mmmm yyyy";

const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
const RULE = { style: "thin", color: { argb: "FFB8C2CE" } };
const MUTED = { argb: "FF6B7785" };

const ACCOUNT_KEYS = ["cash", "bank"];

const ROW_TYPE_LABELS = { income: "Gelir", expense: "Gider", transfer: "Aktarım" };

// Excel counts days in UTC, so a local midnight would slip to the previous day east of Greenwich.
const toExcelDate = (iso) =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));

// An empty rate cell reads better than a dash in a column Excel treats as numbers.
const rateOf = (total, part) => (total > 0 ? part / total : null);

const sumAccounts = (part) => part.cash + part.bank;

// A plain number goes in as a number, or Excel flags every cell as a number stored as text. A leading zero
// or a letter keeps it text, since the number itself would lose it.
const unitNumberOf = (apartmentNo) => (/^[1-9][0-9]*$/.test(apartmentNo) ? Number(apartmentNo) : apartmentNo);

function putRow(sheet, rowNumber, values, formats = []) {
  const row = sheet.getRow(rowNumber);
  values.forEach((value, index) => {
    const cell = row.getCell(index + 1);
    cell.value = value === "" ? null : value;
    if (formats[index] && typeof value !== "string") cell.numFmt = formats[index];
  });
  return row;
}

function styleRow(row, width, style) {
  for (let column = 1; column <= width; column += 1) {
    Object.assign(row.getCell(column), style);
  }
}

// Writes one table from startRow and returns the first free row after it, leaving one blank row as a gap.
// A data sheet asks for a filter, which covers the rows but not the totals beneath them.
function writeTable(sheet, startRow, { head, formats = [], totalFormats = formats, rows, totals = [], empty }) {
  styleRow(putRow(sheet, startRow, head), head.length, {
    font: { bold: true },
    fill: HEAD_FILL,
    border: { bottom: RULE },
  });

  if (rows.length === 0) {
    putRow(sheet, startRow + 1, [empty]).getCell(1).font = { italic: true, color: MUTED };
    return { nextRow: startRow + 3, lastDataRow: null };
  }

  rows.forEach((values, index) => putRow(sheet, startRow + 1 + index, values, formats));
  const lastDataRow = startRow + rows.length;

  totals.forEach((values, index) => {
    styleRow(putRow(sheet, lastDataRow + 1 + index, values, totalFormats), head.length, {
      font: { bold: true },
      border: { top: RULE },
    });
  });

  return { nextRow: lastDataRow + totals.length + 2, lastDataRow };
}

// A data sheet starts with its header on the first row, so the header can be frozen and filtered.
function addDataSheet(workbook, name, widths, table) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = widths.map((width) => ({ width }));
  const { lastDataRow } = writeTable(sheet, 1, table);
  if (lastDataRow) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastDataRow, column: table.head.length } };
  }
  return sheet;
}

function writeHeading(sheet, rowNumber, text) {
  const cell = sheet.getRow(rowNumber).getCell(1);
  cell.value = text;
  cell.font = { bold: true, size: 12 };
  return rowNumber + 1;
}

// Label and value pairs, one per row, each carrying its own number format.
function writePairs(sheet, startRow, pairs) {
  pairs.forEach(([label, value, format], index) => {
    const row = putRow(sheet, startRow + index, [label, value], [null, format]);
    row.getCell(1).font = { color: MUTED };
  });
  return startRow + pairs.length + 1;
}

function writeCashSection(sheet, startRow, data) {
  const net = data.totalIncome - data.totalExpense;
  const opening = data.openingBalance;
  const pairs =
    opening === null
      ? [
          ["Toplam Gelir", data.totalIncome, MONEY],
          ["Toplam Gider", data.totalExpense, MONEY],
          ["Kasa", net, SIGNED_MONEY],
        ]
      : [
          ["Devreden Kasa", opening, SIGNED_MONEY],
          ["Dönem Geliri", data.totalIncome, MONEY],
          ["Dönem Gideri", data.totalExpense, MONEY],
          ["Dönem Neti", net, SIGNED_MONEY],
          ["Dönem Sonu Kasa", opening + net, SIGNED_MONEY],
        ];

  let rowNumber = writeHeading(sheet, startRow, "Kasa Özeti");
  rowNumber = writePairs(sheet, rowNumber, pairs);

  // Same columns as the printed account flow: no opening in the whole ledger, no transfer column without one.
  const { opening: accountOpening, income, expense, transfer, closing } = data.accounts;
  const hasTransfers = transfer.cash !== 0 || transfer.bank !== 0;
  const cellsOf = (openingValue, incomeValue, expenseValue, transferValue, closingValue) => [
    ...(accountOpening ? [openingValue] : []),
    incomeValue,
    expenseValue,
    ...(hasTransfers ? [transferValue] : []),
    closingValue,
  ];
  const head = [
    "Hesap",
    ...(accountOpening ? ["Dönem Başı"] : []),
    "Giren",
    "Çıkan",
    ...(hasTransfers ? ["Aktarım"] : []),
    accountOpening ? "Dönem Sonu" : "Kasa",
  ];
  const formats = [
    null,
    ...(accountOpening ? [SIGNED_MONEY] : []),
    MONEY,
    MONEY,
    ...(hasTransfers ? [SIGNED_MONEY] : []),
    SIGNED_MONEY,
  ];

  return writeTable(sheet, rowNumber, {
    head,
    formats,
    rows: ACCOUNT_KEYS.map((key) => [
      CASH_ACCOUNT_LABELS[key],
      ...cellsOf(accountOpening?.[key], income[key], expense[key], transfer[key], closing[key]),
    ]),
    totals: [
      [
        "Toplam",
        ...cellsOf(
          accountOpening ? sumAccounts(accountOpening) : null,
          sumAccounts(income),
          sumAccounts(expense),
          sumAccounts(transfer),
          sumAccounts(closing),
        ),
      ],
    ],
  }).nextRow;
}

function writeSeveranceSection(sheet, startRow, severance) {
  const rowNumber = writeHeading(sheet, startRow, "Tazminat Kasası");
  return writePairs(sheet, rowNumber, [
    ...(severance.startBalance === null ? [] : [["Dönem Başı Bakiye", severance.startBalance, MONEY]]),
    ["Kasaya Giren", severance.inflow, MONEY],
    ["Ödenen Tazminat", severance.paidOut, MONEY],
    [severance.startBalance === null ? "Kasa Bakiyesi" : "Dönem Sonu Bakiye", severance.endBalance, MONEY],
    ["Tahmini Yükümlülük", severance.liability, MONEY],
  ]);
}

function writeInvestmentSection(sheet, startRow, investment) {
  const rowNumber = writeHeading(sheet, startRow, "Yatırım Aidatı");
  return writePairs(sheet, rowNumber, [
    ...(investment.startBalance === null ? [] : [["Dönem Başı Bakiye", investment.startBalance, SIGNED_MONEY]]),
    ["Fona Giren", investment.inflow, MONEY],
    ["Fondan Harcanan", investment.spent, MONEY],
    [investment.startBalance === null ? "Fon Bakiyesi" : "Dönem Sonu Bakiye", investment.endBalance, SIGNED_MONEY],
    ["Dönem Tahakkuku", investment.accrued, MONEY],
    ["Tahsil Edilen", investment.collected, MONEY],
    ["Tahsilat Oranı", rateOf(investment.accrued, investment.collected), RATE],
  ]);
}

function writeDuesSection(sheet, startRow, data) {
  const counts = { paid: 0, partial: 0, unpaid: 0 };
  data.dues.forEach((row) => {
    counts[row.status] += 1;
  });

  const rowNumber = writeHeading(sheet, startRow, "Aidat Özeti");
  return writePairs(sheet, rowNumber, [
    ["Tahakkuk", data.totalDue, MONEY],
    ["Tahsil Edilen", data.totalPaid, MONEY],
    ["Kalan", data.totalDue - data.totalPaid, MONEY],
    ["Tahsilat Oranı", rateOf(data.totalDue, data.totalPaid), RATE],
    ["Daire Sayısı", data.dues.length],
    ["Tamamını Ödeyen", counts.paid],
    ["Kısmen Ödeyen", counts.partial],
    ["Hiç Ödemeyen", counts.unpaid],
  ]);
}

function addSummarySheet(workbook, { data, title, buildingName }) {
  const sheet = workbook.addWorksheet("Özet");
  sheet.columns = [{ width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const titleCell = sheet.getCell("A1");
  titleCell.value = buildingName;
  titleCell.font = { bold: true, size: 14 };
  sheet.getCell("A2").value = title;
  sheet.getCell("A3").value = `Oluşturulma: ${formatDate(getToday())}`;
  sheet.getCell("A3").font = { color: MUTED };

  let rowNumber = writeCashSection(sheet, 5, data);
  if (data.severance) rowNumber = writeSeveranceSection(sheet, rowNumber, data.severance);
  if (data.investment) rowNumber = writeInvestmentSection(sheet, rowNumber, data.investment);
  writeDuesSection(sheet, rowNumber, data);
}

function writeCategoryTable(sheet, startRow, { rows, total, head, empty }) {
  return writeTable(sheet, startRow, {
    head: [head, "Tutar", "Pay"],
    formats: [null, MONEY, RATE],
    rows: rows.map((row) => [categoryLabel(row.category), row.amount, rateOf(total, row.amount)]),
    totals: [["Toplam", total, ""]],
    empty,
  }).nextRow;
}

function addDistributionSheet(workbook, data) {
  const sheet = workbook.addWorksheet("Dağılım");
  sheet.columns = [{ width: 30 }, { width: 18 }, { width: 10 }];

  const rowNumber = writeCategoryTable(sheet, 1, {
    rows: groupByCategory(data.incomes),
    total: data.totalIncome,
    head: "Gelir Kalemi",
    empty: "Gelir kaydı yok.",
  });
  writeCategoryTable(sheet, rowNumber, {
    rows: groupByCategory(data.expenses),
    total: data.totalExpense,
    head: "Gider Kalemi",
    empty: "Gider kaydı yok.",
  });
}

function addMonthlySheet(workbook, data, year) {
  const figures = buildMonthlyFigures(data, year);
  const due = data.monthlyDues.reduce((sum, row) => sum + row.due_amount, 0);
  const paid = data.monthlyDues.reduce((sum, row) => sum + row.paid_amount, 0);

  addDataSheet(workbook, "Aylık Döküm", [18, 18, 18, 18, 18, 18, 10], {
    head: ["Ay", "Gelir", "Gider", "Net", "Tahakkuk", "Tahsil Edilen", "Oran"],
    formats: [null, MONEY, MONEY, SIGNED_MONEY, MONEY, MONEY, RATE],
    rows: figures.map((row) => [
      formatMonthYear(year, row.month),
      row.income,
      row.expense,
      row.income - row.expense,
      row.due,
      row.paid,
      rateOf(row.due, row.paid),
    ]),
    totals: [
      [
        "Toplam",
        data.totalIncome,
        data.totalExpense,
        data.totalIncome - data.totalExpense,
        due,
        paid,
        rateOf(due, paid),
      ],
    ],
  });
}

function addMovementsSheet(workbook, data) {
  const net = data.totalIncome - data.totalExpense;

  addDataSheet(workbook, "Hareketler", [18, 10, 10, 26, 48, 18], {
    head: ["Tarih", "Tür", "Hesap", "Kategori", "Açıklama", "Tutar"],
    formats: [DATE, null, null, null, null, SIGNED_MONEY],
    rows: buildFinanceRows(data).map((row) => [
      toExcelDate(row.date),
      ROW_TYPE_LABELS[row.rowType],
      CASH_ACCOUNT_LABELS[row.account],
      categoryLabel(row.category),
      row.description || "",
      row.rowType === "income" ? row.amount : -row.amount,
    ]),
    totals: [
      ["Toplam Gelir", "", "", "", "", data.totalIncome],
      ["Toplam Gider", "", "", "", "", -data.totalExpense],
      ["Net", "", "", "", "", net],
    ],
    empty: "Bu dönemde gelir veya gider kaydı yok.",
  });
}

// The totals come from the account flow, so the net equals the bank line of the summary sheet.
function addBankSheet(workbook, data) {
  const { income, expense, transfer } = data.accounts;

  addDataSheet(workbook, "Banka Hareketleri", [18, 10, 26, 48, 18], {
    head: ["Tarih", "Tür", "Kategori", "Açıklama", "Tutar"],
    formats: [DATE, null, null, null, SIGNED_MONEY],
    rows: buildBankRows(data).map((row) => [
      toExcelDate(row.date),
      ROW_TYPE_LABELS[row.rowType],
      categoryLabel(row.category),
      row.description || "",
      bankSign(row) * row.amount,
    ]),
    totals: [
      ["Toplam Gelir", "", "", "", income.bank],
      ["Toplam Gider", "", "", "", -expense.bank],
      ...(data.transfers.length > 0 ? [["Aktarım", "", "", "", transfer.bank]] : []),
      ["Net", "", "", "", income.bank - expense.bank + transfer.bank],
    ],
    empty: "Bu dönemde banka hesabına ait hareket yok.",
  });
}

function addDuesSheet(workbook, data) {
  const formats = [null, null, null, MONEY, MONEY, MONEY, null];

  // Numbers and letter numbers share the column, so one alignment keeps them in a single line.
  const sheet = addDataSheet(workbook, "Aidat Durumu", [10, 12, 30, 16, 16, 16, 16], {
    head: ["Daire", "Kat", "Sakin", "Aidat", "Ödenen", "Kalan", "Durum"],
    formats,
    totalFormats: [...formats.slice(0, 6), RATE],
    rows: data.dues.map((row) => [
      unitNumberOf(row.apartment_no),
      floorLabel(row.floor),
      row.resident_name || EMPTY_RESIDENT_LABEL,
      row.due_amount,
      row.paid_amount,
      row.due_amount - row.paid_amount,
      DUES_STATUS_LABELS[row.status],
    ]),
    totals: [
      [
        "Toplam",
        "",
        "",
        data.totalDue,
        data.totalPaid,
        data.totalDue - data.totalPaid,
        rateOf(data.totalDue, data.totalPaid),
      ],
    ],
    empty: "Aidat kaydı bulunamadı.",
  });
  sheet.getColumn(1).alignment = { horizontal: "left" };
}

export async function buildReportWorkbook({ data, scope, year, month, buildingName }) {
  const title = `${scope.title(year, month)} Raporu`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mavikent Site Yönetimi";
  workbook.title = `${buildingName} ${title}`;

  addSummarySheet(workbook, { data, title, buildingName });
  addDistributionSheet(workbook, data);
  if (data.monthlyDues) addMonthlySheet(workbook, data, year);
  addMovementsSheet(workbook, data);
  addBankSheet(workbook, data);
  addDuesSheet(workbook, data);

  // A copy into a plain Uint8Array, since the buffer the library returns is its own subclass.
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

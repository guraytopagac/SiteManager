// Figures the screen and the saved reports compute. They live beside the document, since the page imports the
// document and keeping them there would create an import loop. The workbook reads the same rows as the PDF,
// so the two files never disagree.

import { TRANSACTION_CATEGORY_LABELS } from "@/utils/constants";
import { getCurrentMonth, getCurrentYear } from "@/utils/date";

export function groupByCategory(rows) {
  const sums = new Map();

  rows.forEach((row) => {
    sums.set(row.category, (sums.get(row.category) ?? 0) + row.amount);
  });

  return [...sums].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export const collectionRate = (due, paid) => (due > 0 ? Math.round((paid / due) * 100) : null);

export const formatRate = (rate) => (rate === null ? "—" : `%${rate}`);

export const categoryLabel = (category) => TRANSACTION_CATEGORY_LABELS[category] ?? category;

export function buildFinanceRows(data) {
  return [
    ...data.incomes.map((r) => ({ ...r, rowType: "income" })),
    ...data.expenses.map((r) => ({ ...r, rowType: "expense" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

// The bank account alone: its income, its expenses and every transfer, since each transfer has one end in it.
export function buildBankRows(data) {
  const transfers = data.transfers.map((row) => ({ ...row, rowType: "transfer" }));
  return [...buildFinanceRows(data).filter((row) => row.account === "bank"), ...transfers].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// A transfer is signed from the bank's side, so a deposit adds and a withdrawal takes away.
export function bankSign(row) {
  if (row.rowType === "transfer") return row.category === "to_bank" ? 1 : -1;
  return row.rowType === "income" ? 1 : -1;
}

// One entry per month of the yearly report, up to the running month in the running year.
export function buildMonthlyFigures(data, year) {
  const lastMonth = year === getCurrentYear() ? getCurrentMonth() : 12;
  const sumMonth = (rows, month) =>
    rows.filter((row) => Number(row.date.slice(5, 7)) === month).reduce((sum, row) => sum + row.amount, 0);

  return Array.from({ length: lastMonth }, (_, index) => {
    const month = index + 1;
    const dues = data.monthlyDues.find((row) => row.month === month);
    return {
      month,
      income: sumMonth(data.incomes, month),
      expense: sumMonth(data.expenses, month),
      due: dues ? dues.due_amount : 0,
      paid: dues ? dues.paid_amount : 0,
    };
  });
}

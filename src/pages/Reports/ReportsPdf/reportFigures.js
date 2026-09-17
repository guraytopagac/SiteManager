// Figures the screen and the printed report both compute. They live beside the document, since the page
// imports the document and keeping them there would create an import loop.

import { TRANSACTION_CATEGORY_LABELS } from "@/utils/constants";

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

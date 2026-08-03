const LOCALE = "tr-TR";
const SUFFIX = " ₺";
const FRACTION_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const EMPTY = "—";

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return EMPTY;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return EMPTY;
  return amount.toLocaleString(LOCALE, FRACTION_OPTIONS) + SUFFIX;
}

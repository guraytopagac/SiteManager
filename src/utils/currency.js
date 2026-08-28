const LOCALE = "tr-TR";
const SUFFIX = " ₺";
const EMPTY = "—";

const FORMATTER = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCurrency = (value) => {
  const input = String(value ?? "").trim();
  const amount = input === "" ? NaN : Number(input);
  if (!Number.isFinite(amount)) return EMPTY;
  return FORMATTER.format(amount || 0) + SUFFIX;
};

export const formatSignedCurrency = (value) => {
  const text = formatCurrency(value);
  return Number(value) > 0 ? `+${text}` : text;
};

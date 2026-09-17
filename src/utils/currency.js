// Money formatting for the renderer. Amounts are stored as REAL and are only ever turned into text here.

const LOCALE = "tr-TR";
const SUFFIX = " ₺";
const EMPTY = "—";

// Built once at module level. toLocaleString with an options object builds a fresh formatter on every call, and
// the Transactions and Reports tables run this per cell.
const FORMATTER = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCurrency = (value) => {
  const input = String(value ?? "").trim();
  const amount = input === "" ? NaN : Number(input);
  if (!Number.isFinite(amount)) return EMPTY;
  // `|| 0` folds -0 into 0, otherwise a zero expense total would print with a leading minus sign.
  return FORMATTER.format(amount || 0) + SUFFIX;
};

// Direction is carried by the sign of the value the caller passes, so an expense row calls this with -amount.
// Intl already writes the minus, only the plus has to be added.
export const formatSignedCurrency = (value) => {
  const text = formatCurrency(value);
  return Number(value) > 0 ? `+${text}` : text;
};

const ONES = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
const TENS = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
const SCALES = ["", "Bin", "Milyon", "Milyar"];
// Far above the largest amount any handler accepts (1.000.000). The bound only guards the end of SCALES.
const MAX_WORDS_AMOUNT = 1e12;

// Turkish drops the word for one before the hundreds and the thousands scale but keeps it from millions up,
// so a group of 1 is spelled out everywhere except the thousands scale.
const hundredsInWords = (group) => {
  const hundreds = Math.floor(group / 100);
  const words = [];
  if (hundreds > 1) words.push(ONES[hundreds]);
  if (hundreds > 0) words.push("Yüz");
  words.push(TENS[Math.floor(group / 10) % 10], ONES[group % 10]);
  return words.filter(Boolean);
};

const integerInWords = (value) => {
  if (value === 0) return "Sıfır";
  const groups = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  const words = groups.flatMap((group, scale) => {
    if (group === 0) return [];
    const digits = scale === 1 && group === 1 ? [] : hundredsInWords(group);
    return [[...digits, SCALES[scale]].filter(Boolean)];
  });
  return words.reverse().flat().join(" ");
};

export const formatCurrencyInWords = (value) => {
  const input = String(value ?? "").trim();
  const amount = input === "" ? NaN : Number(input);
  if (!Number.isFinite(amount) || amount < 0 || amount >= MAX_WORDS_AMOUNT) return EMPTY;
  const totalCents = Math.round(amount * 100);
  const lira = Math.floor(totalCents / 100);
  const kurus = totalCents % 100;
  const parts = [];
  if (lira > 0 || kurus === 0) parts.push(`${integerInWords(lira)} Türk Lirası`);
  if (kurus > 0) parts.push(`${integerInWords(kurus)} Kuruş`);
  return parts.join(" ");
};

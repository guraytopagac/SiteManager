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

const ONES = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
const TENS = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
const SCALES = ["", "Bin", "Milyon", "Milyar"];
const MAX_WORDS_AMOUNT = 1e12;

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

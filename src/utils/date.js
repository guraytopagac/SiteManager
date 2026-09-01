const LOCALE = "tr-TR";
const TR_OFFSET_MS = 3 * 3600 * 1000;
const EMPTY = "—";
const YEAR_OPTION_COUNT = 5;

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });

const nowInTr = () => new Date(Date.now() + TR_OFFSET_MS);

const toDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(" ", "T");
  const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const monthLimit = (year) => {
  const today = getToday();
  const currentYear = Number(today.slice(0, 4));
  if (Number(year) < currentYear) return MONTHS.length;
  return Number(year) === currentYear ? Number(today.slice(5, 7)) : 0;
};

export const getToday = () => nowInTr().toISOString().slice(0, 10);
export const getCurrentYear = () => Number(getToday().slice(0, 4));
export const getCurrentMonth = () => Number(getToday().slice(5, 7));

export const formatDate = (value) => {
  const date = toDate(value);
  return date ? DATE_FORMATTER.format(date) : EMPTY;
};

export const formatMonthYear = (year, month) => {
  const name = MONTHS[Number(month) - 1];
  const text = String(year ?? "").trim();
  if (!name || text === "" || !Number.isInteger(Number(text))) return EMPTY;
  return `${name} ${text}`;
};

export const getYearOptions = () => {
  const current = getCurrentYear();
  return Array.from({ length: YEAR_OPTION_COUNT }, (_, i) => current - i);
};

export const getMonthOptions = (year) =>
  MONTHS.slice(0, monthLimit(year)).map((name, index) => ({ value: index + 1, label: name }));

export const clampMonth = (year, month) => {
  const limit = monthLimit(year);
  return limit > 0 ? Math.min(month, limit) : 1;
};

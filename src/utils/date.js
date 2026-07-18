const LOCALE = "tr-TR";
const TR_OFFSET_MS = 3 * 3600 * 1000;
const EMPTY = "—";

export const MONTHS = [
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

const nowInTr = () => new Date(Date.now() + TR_OFFSET_MS);

const parse = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: true };
  }
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(" ", "T");
  const hasTime = text.includes("T");
  const date = new Date(hasTime ? text : `${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : { date, hasTime };
};

const format = (value, options) => {
  const parsed = parse(value);
  return parsed ? parsed.date.toLocaleDateString(LOCALE, options) : EMPTY;
};

const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit" };
const SHORT_DATE_OPTIONS = { day: "2-digit", month: "2-digit", year: "numeric" };

export const getToday = () => nowInTr().toISOString().slice(0, 10);

export const getCurrentYear = () => Number(getToday().slice(0, 4));

export const getCurrentMonth = () => Number(getToday().slice(5, 7));

export const formatDate = (value) => format(value, { day: "numeric", month: "long", year: "numeric" });

export const formatDateShort = (value) => format(value, SHORT_DATE_OPTIONS);

export const formatTime = (value) => {
  const parsed = parse(value);
  if (!parsed || !parsed.hasTime) return EMPTY;
  return parsed.date.toLocaleTimeString(LOCALE, TIME_OPTIONS);
};

export const formatDateTime = (value) => {
  const parsed = parse(value);
  if (!parsed) return EMPTY;
  const day = parsed.date.toLocaleDateString(LOCALE, SHORT_DATE_OPTIONS);
  if (!parsed.hasTime) return day;
  return `${day} ${parsed.date.toLocaleTimeString(LOCALE, TIME_OPTIONS)}`;
};

export const formatMonthYear = (year, month) => {
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : EMPTY;
};

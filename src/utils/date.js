// Renderer half of the local time rules. electron/modules/shared/trTime.js carries the same logic, and the
// duplication is deliberate: the two live in different module systems and share nothing but IPC.

const LOCALE = "tr-TR";
const TR_OFFSET_MS = 3 * 3600 * 1000;
const EMPTY = "—";
const FALLBACK_YEAR_SPAN = 5;

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

// Built once, same reason as the currency formatter: formatDate runs per table row.
const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });

// Written once at startup from getSetupState, and again on completeSetup. Deliberately not reactive, the
// account year cannot change while the app is running.
let ledgerStartYear = null;

const nowInTr = () => new Date(Date.now() + TR_OFFSET_MS);

// Named toDate rather than parse because it carries no time component: the app has a single display format
// and never shows a clock.
const toDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(" ", "T");
  const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

// A future year yields zero months. getYearOptions never produces one today, but the rule is written by
// comparison rather than `=== currentYear` so selector logic does not depend on that list's contents.
const monthLimit = (year) => {
  const today = getToday();
  const currentYear = Number(today.slice(0, 4));
  if (Number(year) < currentYear) return MONTHS.length;
  return Number(year) === currentYear ? Number(today.slice(5, 7)) : 0;
};

export const getToday = () => nowInTr().toISOString().slice(0, 10);
export const getCurrentYear = () => Number(getToday().slice(0, 4));
export const getCurrentMonth = () => Number(getToday().slice(5, 7));

export const toPeriod = (year, month) => Number(year) * 12 + Number(month);

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

export const setLedgerStartYear = (year) => {
  ledgerStartYear = Number.isInteger(year) ? year : null;
};

// The base is the account's own year, so the useful range grows by one every year. Math.min guards a restored
// backup or a clock set forward, and the fallback is generous: hiding existing data is worse than empty months.
export const getYearOptions = () => {
  const current = getCurrentYear();
  const first = ledgerStartYear === null ? current - FALLBACK_YEAR_SPAN : Math.min(ledgerStartYear, current);
  const years = [];

  for (let year = current; year >= first; year -= 1) {
    years.push(year);
  }

  return years;
};

// Lower bound of the date inputs that feed the period selectors, so no record lands in a month the selector
// cannot reach. Resident dates stay outside it, being older than the account is a fact rather than a slip.
export const getMinDate = () => (ledgerStartYear === null ? undefined : `${ledgerStartYear}-01-01`);

export const getMonthOptions = (year) =>
  MONTHS.slice(0, monthLimit(year)).map((name, index) => ({ value: index + 1, label: name }));

export const clampMonth = (year, month) => {
  const limit = monthLimit(year);
  // An empty option list falls back to 1, otherwise Math.min would produce an invalid 0.
  return limit > 0 ? Math.min(month, limit) : 1;
};

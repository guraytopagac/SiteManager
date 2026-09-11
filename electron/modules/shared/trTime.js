// The only place Turkish local time is handled in the main process. The renderer has its own copy
// in src/utils/date.js. That copy is on purpose, since the two module systems cannot share a file.
// Turkey has no summer time, so a fixed +3 shift is always correct.
const TR_OFFSET_MS = 3 * 3600 * 1000;
// The only place this SQL text is written, apart from the column defaults.
const TR_NOW_SQL = "datetime('now', '+3 hours')";

function trNow() {
  return new Date(Date.now() + TR_OFFSET_MS);
}

function trToday() {
  return trNow().toISOString().slice(0, 10);
}

// Read with getUTC*, because trNow has already been shifted by +3.
function trYearMonth() {
  const now = trNow();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

// Never write year * 12 + month by hand, use this.
function toPeriod(year, month) {
  return year * 12 + month;
}

function currentPeriod() {
  const { year, month } = trYearMonth();
  return toPeriod(year, month);
}

// The SQL version of toPeriod. The argument is a SQL date expression, not a value, so it is only
// ever called with text this module or another module owns.
function periodSql(expression) {
  return `CAST(strftime('%Y', ${expression}) AS INTEGER) * 12 + CAST(strftime('%m', ${expression}) AS INTEGER)`;
}

// The period of a row's own created_at, for comparing periods inside a query.
function createdPeriodSql(alias = "") {
  return periodSql(`${alias}created_at`);
}

// The last day of a month, inclusive. monthBounds gives the exclusive end instead, which reads
// better in a range filter but cannot be compared against a stored date on its own.
function monthEnd(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// Start and end of a month, for date >= start AND date < end. The end day is not included.
function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

module.exports = {
  TR_NOW_SQL,
  createdPeriodSql,
  currentPeriod,
  monthBounds,
  monthEnd,
  periodSql,
  toPeriod,
  trToday,
  trYearMonth,
};

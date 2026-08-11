const TR_OFFSET_MS = 3 * 3600 * 1000;
const TR_NOW_SQL = "datetime('now', '+3 hours')";

function trNow() {
  return new Date(Date.now() + TR_OFFSET_MS);
}

function trToday() {
  return trNow().toISOString().slice(0, 10);
}

function trYearMonth() {
  const now = trNow();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

module.exports = { TR_NOW_SQL, monthBounds, trToday, trYearMonth };

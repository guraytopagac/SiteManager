const TR_OFFSET_MS = 3 * 3600 * 1000;

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

module.exports = { trNow, trToday, trYearMonth };

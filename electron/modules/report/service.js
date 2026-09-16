// Report data for one month, one year or the whole ledger. It only reads, and it never rounds
// money. That is the renderer's job.
const { getDb } = require("../../../database/db");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { RESIDENT_NAME_FOR_PERIOD_SQL, periodCutoff } = require("../shared/residentPeriod");
const { createdPeriodSql, monthBounds, toPeriod, trToday } = require("../shared/trTime");

// The natural apartment order. This text has to stay identical to the one in dues/service.js and
// resident/service.js, see the sorting rule in the docs.
const UNIT_ORDER_SQL = `ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
          CAST(a.apartment_no AS INTEGER) ASC,
          a.apartment_no COLLATE NOCASE ASC`;

// What a scope covers. start and end bound the cash rows (end is exclusive) and are null for the
// whole ledger. cutoff is the day the resident subquery answers for, clipped to today so a report
// of the running year does not name a resident whose move-out is still ahead.
function reportRange(scope, year, month) {
  if (scope === "month") {
    const { start, end } = monthBounds(year, month);
    return { start, end, cutoff: periodCutoff(year, month) };
  }
  if (scope === "year") {
    return { start: `${year}-01-01`, end: `${year + 1}-01-01`, cutoff: periodCutoff(year, 12) };
  }
  return { start: null, end: null, cutoff: trToday() };
}

// The records of one range that are not cancelled. The table name comes from a fixed string only.
// The category feeds the breakdown, both on screen and in the PDF.
function fetchRange(table, buildingId, { start, end }) {
  const dateFilter = start === null ? "" : "AND date >= ? AND date < ?";
  const params = start === null ? [buildingId] : [buildingId, start, end];

  return getDb()
    .prepare(
      `SELECT id, amount, date, description, category
       FROM ${table}
       WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
       ORDER BY date ASC, id ASC`,
    )
    .all(...params);
}

// The cash carried into a range: every uncancelled record dated before it. The whole ledger has
// nothing before it, so it gets null rather than a zero that would read as an empty till.
function fetchOpeningBalance(buildingId, start) {
  if (start === null) return null;

  return getDb()
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM incomes
          WHERE building_id = ? AND is_cancelled = 0 AND date < ?)
         -
         (SELECT COALESCE(SUM(amount), 0) FROM expenses
          WHERE building_id = ? AND is_cancelled = 0 AND date < ?) AS balance`,
    )
    .get(buildingId, start, buildingId, start).balance;
}

// The yearly report's month by month dues line. Only active apartments count, like every other
// dues figure in the report.
function fetchMonthlyDues(buildingId, year) {
  return getDb()
    .prepare(
      `SELECT d.month, SUM(d.due_amount) AS due_amount, SUM(d.paid_amount) AS paid_amount
       FROM dues d
       JOIN apartments a ON a.id = d.apartment_id
       WHERE a.building_id = ? AND a.is_active = 1 AND d.year = ?
       GROUP BY d.month
       ORDER BY d.month ASC`,
    )
    .all(buildingId, year);
}

// Same resident subquery, same month filter, same ordering and same binding order as
// getDuesForMonth. A report of a past month names the residents of that month.
function fetchMonthDues(buildingId, year, month, cutoff) {
  return getDb()
    .prepare(
      `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
              ${RESIDENT_NAME_FOR_PERIOD_SQL} AS resident_name,
              COALESCE(d.due_amount, a.due_amount) AS due_amount,
              COALESCE(d.paid_amount, 0) AS paid_amount,
              COALESCE(d.status, 'unpaid') AS status
       FROM apartments a
       LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
       WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
       ${UNIT_ORDER_SQL}`,
    )
    .all(cutoff, cutoff, year, month, buildingId, toPeriod(year, month));
}

// A year or the whole ledger, summed per apartment. The join is inner on purpose: an apartment
// with no accrued month inside the range did not exist yet and has nothing to report, while the
// monthly query still needs its LEFT JOIN because the month in progress may not be accrued.
// The status is derived from the sums with the same rule the dues table's CHECK uses.
function fetchAggregatedDues(buildingId, year, cutoff) {
  const yearFilter = year === null ? "" : "AND d.year = ?";
  const params = year === null ? [cutoff, cutoff, buildingId] : [cutoff, cutoff, year, buildingId];

  return getDb()
    .prepare(
      `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
              ${RESIDENT_NAME_FOR_PERIOD_SQL} AS resident_name,
              SUM(d.due_amount) AS due_amount,
              SUM(d.paid_amount) AS paid_amount,
              CASE
                WHEN SUM(d.paid_amount) >= SUM(d.due_amount) THEN 'paid'
                WHEN SUM(d.paid_amount) > 0 THEN 'partial'
                ELSE 'unpaid'
              END AS status
       FROM apartments a
       JOIN dues d ON d.apartment_id = a.id ${yearFilter}
       WHERE a.building_id = ? AND a.is_active = 1
       GROUP BY a.id
       ${UNIT_ORDER_SQL}`,
    )
    .all(...params);
}

// The dues rows carry apartment_id, which the renderer needs.
function getReportData(payload) {
  const { buildingId, scope, year, month } = payload;
  try {
    // Accrue before reading, like the dues list does.
    ensureMonthlyDues(buildingId);

    const range = reportRange(scope, year, month);

    const incomes = fetchRange("incomes", buildingId, range);
    const expenses = fetchRange("expenses", buildingId, range);

    const dues =
      scope === "month"
        ? fetchMonthDues(buildingId, year, month, range.cutoff)
        : fetchAggregatedDues(buildingId, scope === "year" ? year : null, range.cutoff);

    const totalIncome = incomes.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
    const totalDue = dues.reduce((sum, r) => sum + r.due_amount, 0);
    const totalPaid = dues.reduce((sum, r) => sum + r.paid_amount, 0);
    const openingBalance = fetchOpeningBalance(buildingId, range.start);
    const monthlyDues = scope === "year" ? fetchMonthlyDues(buildingId, year) : null;

    return {
      success: true,
      data: {
        incomes,
        expenses,
        dues,
        totalIncome,
        totalExpense,
        totalDue,
        totalPaid,
        openingBalance,
        monthlyDues,
      },
    };
  } catch (err) {
    console.error("[report.service] getReportData:", err);
    return { success: false, message: "Rapor verileri alınamadı." };
  }
}

module.exports = { getReportData };

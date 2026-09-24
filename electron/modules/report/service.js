// Report data for one month, one year or the whole ledger. It only reads, and it never rounds
// money. That is the renderer's job.
const { getDb } = require("../../../database/db");
const { cashBalances, cashFlow } = require("../shared/cashAccounts");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { investmentBalance } = require("../shared/investmentFund");
const { RESIDENT_NAME_FOR_PERIOD_SQL, periodCutoff } = require("../shared/residentPeriod");
const { estimatedLiability, severanceBalance } = require("../shared/severanceFund");
const { createdPeriodSql, monthBounds, toPeriod, trToday, trYearMonth } = require("../shared/trTime");

// The natural apartment order. This text has to stay identical to the copies in dues/service.js,
// investment/service.js and resident/service.js.
const UNIT_ORDER_SQL = `ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
          CAST(a.apartment_no AS INTEGER) ASC,
          rtrim(a.apartment_no, '0123456789') COLLATE NOCASE ASC,
          CAST(substr(a.apartment_no, length(rtrim(a.apartment_no, '0123456789')) + 1) AS INTEGER) ASC,
          a.apartment_no COLLATE NOCASE ASC`;

// What a scope covers. start and end bound the cash rows (end is exclusive) and are null for the whole
// ledger. cutoff is the day the resident subquery answers for, clipped to today.
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
      `SELECT id, amount, date, description, category, account
       FROM ${table}
       WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
       ORDER BY date ASC, id ASC`,
    )
    .all(...params);
}

// The account transfers of one range. They are neither income nor expense, so they stay out of every total
// and are listed on their own. The category mirrors the one the ledger gives them, so both screens label a
// transfer with the same words.
function fetchTransfers(buildingId, { start, end }) {
  const dateFilter = start === null ? "" : "AND date >= ? AND date < ?";
  const params = start === null ? [buildingId] : [buildingId, start, end];

  return getDb()
    .prepare(
      `SELECT id, amount, date, description,
              CASE to_account WHEN 'bank' THEN 'to_bank' ELSE 'to_cash' END AS category
       FROM cash_transfers
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

// A month after this one has a row only when it was paid ahead. It is not due yet, so no report counts it:
// a yearly total would otherwise show one apartment's accrual for a month nobody else owes yet.
const DUE_SO_FAR_SQL = "(d.year < ? OR (d.year = ? AND d.month <= ?))";

function dueSoFarParams() {
  const { year, month } = trYearMonth();
  return [year, year, month];
}

// The yearly report's month by month dues line. Only active apartments count, like every other dues
// figure in the report, and only the monthly charge: the fund has a section of its own.
function fetchMonthlyDues(buildingId, year) {
  return getDb()
    .prepare(
      `SELECT d.month, SUM(d.due_amount) AS due_amount, SUM(d.paid_amount) AS paid_amount
       FROM dues d
       JOIN apartments a ON a.id = d.apartment_id
       WHERE a.building_id = ? AND a.is_active = 1 AND d.year = ? AND d.due_type = 'regular' AND ${DUE_SO_FAR_SQL}
       GROUP BY d.month
       ORDER BY d.month ASC`,
    )
    .all(buildingId, year, ...dueSoFarParams());
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
       LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ? AND d.due_type = 'regular'
       WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
       ${UNIT_ORDER_SQL}`,
    )
    .all(cutoff, cutoff, year, month, buildingId, toPeriod(year, month));
}

// A year or the whole ledger, summed per apartment. The join is inner on purpose: an apartment with no
// accrued month in the range did not exist yet, while the monthly query still needs its LEFT JOIN. The
// status is derived from the sums with the same rule the CHECK on dues uses.
function fetchAggregatedDues(buildingId, year, cutoff) {
  const yearFilter = year === null ? "" : "AND d.year = ?";
  const params = year === null ? [cutoff, cutoff] : [cutoff, cutoff, year];

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
       JOIN dues d ON d.apartment_id = a.id AND d.due_type = 'regular' ${yearFilter} AND ${DUE_SO_FAR_SQL}
       WHERE a.building_id = ? AND a.is_active = 1
       GROUP BY a.id
       ${UNIT_ORDER_SQL}`,
    )
    .all(...params, ...dueSoFarParams(), buildingId);
}

// The fund's own section. The balances are taken on both edges of the range, so whatever entered the fund
// in between (transfers, and the opening balance when the fund was started in the range) is their
// difference plus the payouts. The liability is today's estimate, whatever range is printed. A range that
// ends before the fund was started gets no section: its first transfer falls on the first day of the start
// month, and a range always ends on a month boundary.
function fetchSeverance(buildingId, { start, end }) {
  const fund = getDb()
    .prepare(`SELECT date(created_at) AS started_on FROM severance_funds WHERE building_id = ?`)
    .get(buildingId);
  if (!fund || (end !== null && fund.started_on >= end)) return null;

  const endBalance = severanceBalance(buildingId, end ?? undefined);

  const dateFilter = start === null ? "" : "AND date >= ? AND date < ?";
  const params = start === null ? [buildingId] : [buildingId, start, end];
  const { paidOut } = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS paidOut FROM severance_payouts
       WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}`,
    )
    .get(...params);

  const startBalance = start === null ? 0 : severanceBalance(buildingId, start);
  return {
    startBalance: start === null ? null : startBalance,
    inflow: endBalance - startBalance + paidOut,
    paidOut,
    endBalance,
    liability: estimatedLiability(buildingId, trToday()),
  };
}

// The investment fund's own section, built the way the severance one is: the balances are taken on both
// edges of the range, so whatever entered the fund in between is their difference plus what it paid for. The
// accrual is counted by period rather than by date, because a charge belongs to the month it was raised
// however late it is paid, and that keeps the balance line and the accrual line answering different questions.
function fetchInvestment(buildingId, { start, end }, scope, year, month) {
  const fund = getDb()
    .prepare(`SELECT date(created_at) AS started_on FROM investment_funds WHERE building_id = ?`)
    .get(buildingId);
  if (!fund || (end !== null && fund.started_on >= end)) return null;

  const endBalance = investmentBalance(buildingId, end ?? undefined);
  const startBalance = start === null ? 0 : investmentBalance(buildingId, start);

  const dateFilter = start === null ? "" : "AND date >= ? AND date < ?";
  const spentParams = start === null ? [buildingId] : [buildingId, start, end];
  const { spent } = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS spent FROM expenses
       WHERE building_id = ? AND is_investment = 1 AND is_cancelled = 0 ${dateFilter}`,
    )
    .get(...spentParams);

  const periodFilter = scope === "month" ? "AND d.year = ? AND d.month = ?" : scope === "year" ? "AND d.year = ?" : "";
  const periodParams = scope === "month" ? [year, month] : scope === "year" ? [year] : [];
  const { accrued, collected } = getDb()
    .prepare(
      `SELECT COALESCE(SUM(d.due_amount), 0) AS accrued, COALESCE(SUM(d.paid_amount), 0) AS collected
       FROM dues d
       JOIN apartments a ON a.id = d.apartment_id
       WHERE a.building_id = ? AND a.is_active = 1 AND d.due_type = 'investment' ${periodFilter}`,
    )
    .get(buildingId, ...periodParams);

  return {
    startBalance: start === null ? null : startBalance,
    inflow: endBalance - startBalance + spent,
    spent,
    endBalance,
    accrued,
    collected,
  };
}

function getReportData(payload) {
  const { buildingId, scope, year, month } = payload;
  try {
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
        transfers: fetchTransfers(buildingId, range),
        severance: fetchSeverance(buildingId, range),
        investment: fetchInvestment(buildingId, range, scope, year, month),
        // The main cash followed account by account, so opening + income - expense + transfer = closing on
        // every row. The whole ledger has nothing before it, so it gets no opening, and it ends today.
        accounts: {
          opening: range.start === null ? null : cashBalances(buildingId, range.start),
          ...cashFlow(buildingId, range.start, range.end),
          closing: cashBalances(buildingId, range.end ?? undefined),
        },
      },
    };
  } catch (err) {
    console.error("[report.service] getReportData:", err);
    return { success: false, message: "Rapor verileri alınamadı." };
  }
}

module.exports = { getReportData };

// The investment fund of a building: the monthly contribution charged to the owners and the balance that
// contribution builds up. Accrual and balance live together because both read the same fund row. A
// contribution is a dues row of the investment type, so it is collected through the ordinary payment path.
const { getDb } = require("../../../database/db");
const { createdPeriodSql, currentPeriod, toPeriod } = require("./trTime");

// Fills the missing investment dues of a building: one per active apartment per month, from the month the
// fund accrues from up to this month. Idempotent, and called before every read, the same way the monthly
// dues are filled in. A stopped fund accrues nothing, and starting it again moves accrual_from forward, so
// the months that were skipped never appear.
function ensureInvestmentDues(buildingId) {
  const fund = getDb()
    .prepare(`SELECT monthly_amount, accrual_from FROM investment_funds WHERE building_id = ? AND is_collecting = 1`)
    .get(buildingId);

  if (!fund) return;

  const [startYear, startMonth] = fund.accrual_from.split("-").map(Number);
  const startPeriod = toPeriod(startYear, startMonth);
  const endPeriod = currentPeriod();
  if (startPeriod > endPeriod) return;

  // The recursive CTE lists the months, the join keeps an apartment out of the months before it existed,
  // so an apartment added later starts owing from the month it was created. CAST is required: better-sqlite3
  // binds numbers as REAL and / only divides as integers when both sides are.
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_type, due_amount)
     WITH RECURSIVE periods(period) AS (
       SELECT CAST(? AS INTEGER)
       UNION ALL
       SELECT period + 1 FROM periods WHERE period + 1 <= ?
     )
     SELECT a.id, (p.period - 1) / 12, (p.period - 1) % 12 + 1, 'investment', ?
     FROM apartments a
     JOIN periods p ON p.period >= ${createdPeriodSql("a.")}
     WHERE a.building_id = ? AND a.is_active = 1`,
    )
    .run(startPeriod, endPeriod, fund.monthly_amount, buildingId);
}

// The fund in figures: the opening balance, what has been collected into it and what has been spent out of
// it. With a date, only what happened before that day counts, and the opening balance counts from the day
// the fund was started. Null when there is no fund. The default date is past every valid record, so without
// one the whole ledger is summed. The balance can go negative: an expense is never refused for being larger
// than the fund, the money really did leave the main cash.
function investmentTotals(buildingId, before = "9999-12-31") {
  const row = getDb()
    .prepare(
      `SELECT CASE WHEN date(f.created_at) < ? THEN f.opening_balance ELSE 0 END AS opening,
              (SELECT COALESCE(SUM(i.amount), 0) FROM incomes i
               WHERE i.building_id = f.building_id AND i.category = 'investment_dues' AND i.is_cancelled = 0
                 AND i.date < ?) AS collected,
              (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
               WHERE e.building_id = f.building_id AND e.is_investment = 1 AND e.is_cancelled = 0
                 AND e.date < ?) AS spent
       FROM investment_funds f WHERE f.building_id = ?`,
    )
    .get(before, before, before, buildingId);

  if (!row) return null;
  return { ...row, balance: row.opening + row.collected - row.spent };
}

// The balance alone, for the callers that need no breakdown.
function investmentBalance(buildingId, before) {
  const totals = investmentTotals(buildingId, before);
  return totals ? totals.balance : null;
}

module.exports = { ensureInvestmentDues, investmentBalance, investmentTotals };

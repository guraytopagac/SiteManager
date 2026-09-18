// The severance fund parts more than one module reads: the balance and the liability estimate. A transfer is
// an expense of the severance_fund category and has no table of its own, the manager enters it by hand.
const { getDb } = require("../../../database/db");

// Opening balance plus live transfers minus live payouts. With a date, only what happened before that day
// counts, and the opening balance counts from the day the fund was started. Null when there is no fund.
// The default date is past every valid record, so without one the whole ledger is summed.
function severanceBalance(buildingId, before = "9999-12-31") {
  const row = getDb()
    .prepare(
      `SELECT CASE WHEN date(f.created_at) < ? THEN f.opening_balance ELSE 0 END
              + (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
                 WHERE e.building_id = f.building_id AND e.category = 'severance_fund' AND e.is_cancelled = 0
                   AND e.date < ?)
              - (SELECT COALESCE(SUM(p.amount), 0) FROM severance_payouts p
                 WHERE p.building_id = f.building_id AND p.is_cancelled = 0 AND p.date < ?) AS balance
       FROM severance_funds f WHERE f.building_id = ?`,
    )
    .get(before, before, before, buildingId);
  return row ? row.balance : null;
}

// The right to severance starts after one full year. Before that the estimate is zero.
function hasFullYear(startDate, asOf) {
  const [year, month, day] = startDate.split("-");
  return `${Number(year) + 1}-${month}-${day}` <= asOf;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

// Gross wage times the years worked, with no legal ceiling. Only an estimate, the reason for leaving
// decides whether anything is owed at all.
function withSeveranceEstimate(employee, asOf) {
  const workedDays = Math.max(daysBetween(employee.start_date, asOf), 0);
  const isEligible = hasFullYear(employee.start_date, asOf);
  return {
    ...employee,
    worked_days: workedDays,
    is_eligible: isEligible,
    liability: isEligible ? (employee.gross_wage * workedDays) / 365 : 0,
  };
}

// The summed estimate of the employees who have not left.
function estimatedLiability(buildingId, asOf) {
  return getDb()
    .prepare(`SELECT start_date, gross_wage FROM employees WHERE building_id = ? AND end_date IS NULL`)
    .all(buildingId)
    .reduce((sum, employee) => sum + withSeveranceEstimate(employee, asOf).liability, 0);
}

module.exports = { daysBetween, estimatedLiability, severanceBalance, withSeveranceEstimate };

// The open advance of an employee. An advance is a staff_advance expense and a repayment an advance_repayment
// income, both naming the employee, so the balance is derived and never stored. More than one module reads it:
// the ledger checks a repayment and a cancel against it, the severance page shows it.
const { getDb } = require("../../../database/db");

const BALANCE_SQL = `
  SELECT employee_id, SUM(amount) AS balance FROM (
    SELECT employee_id, amount FROM expenses
    WHERE building_id = ? AND category = 'staff_advance' AND is_cancelled = 0
    UNION ALL
    SELECT employee_id, -amount FROM incomes
    WHERE building_id = ? AND category = 'advance_repayment' AND is_cancelled = 0
  )`;

// Employee id to open advance, for every employee of the building who ever took one. Money is not rounded here.
function advanceBalances(buildingId) {
  const rows = getDb().prepare(`${BALANCE_SQL} GROUP BY employee_id`).all(buildingId, buildingId);
  return new Map(rows.map((row) => [row.employee_id, row.balance]));
}

function advanceBalance(buildingId, employeeId) {
  return advanceBalances(buildingId).get(employeeId) ?? 0;
}

// Whether the employee is named by any advance or repayment, cancelled ones included.
function hasAdvanceRecords(employeeId) {
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM expenses WHERE employee_id = ?
         UNION ALL
         SELECT 1 FROM incomes WHERE employee_id = ?
         LIMIT 1`,
      )
      .get(employeeId, employeeId),
  );
}

module.exports = { advanceBalance, advanceBalances, hasAdvanceRecords };

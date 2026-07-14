const { db } = require("../../../database/db");

function fetchStats(managerId, year, month) {
  const { totalIncome } = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM incomes WHERE manager_id = ? AND is_cancelled = 0`)
    .get(managerId);

  const { totalExpense } = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses WHERE manager_id = ? AND is_cancelled = 0`)
    .get(managerId);

  const currentMonthDue = db
    .prepare(
      `SELECT COALESCE(SUM(d.due_amount), 0) AS totalDue, COALESCE(SUM(d.paid_amount), 0) AS totalPaid
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.manager_id = ? AND a.is_active = 1 AND d.year = ? AND d.month = ?`,
    )
    .get(managerId, year, month);

  const { totalOverdue } = db
    .prepare(
      `SELECT COALESCE(SUM(d.due_amount - d.paid_amount), 0) AS totalOverdue
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.manager_id = ? AND a.is_active = 1 AND (d.year < ? OR (d.year = ? AND d.month < ?)) AND d.status != 'paid'`,
    )
    .get(managerId, year, year, month);

  return { totalIncome, totalExpense, currentMonthDue, totalOverdue };
}

function getStats(managerId) {
  try {
    const now = new Date(Date.now() + 3 * 3600 * 1000);
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    const { totalIncome, totalExpense, currentMonthDue, totalOverdue } = fetchStats(
      managerId,
      currentYear,
      currentMonth,
    );

    const cash = Number(totalIncome) - Number(totalExpense);
    const currentDue = Number(currentMonthDue.totalDue);
    const currentPaid = Number(currentMonthDue.totalPaid);
    const collections = currentDue > 0 ? Math.min(Math.round((currentPaid / currentDue) * 100), 100) : 0;
    const delays = Math.round(Number(totalOverdue));

    return { success: true, payload: { cash, collections, delays } };
  } catch (err) {
    console.error("[dashboard.service] getStats:", err);
    return { success: false, message: "Dashboard verileri alınamadı." };
  }
}

module.exports = { getStats };

const db = require("../../database/db");

function getStats(managerId) {
  if (!managerId) {
    return { success: true, payload: { cash: 0, collections: 0, delays: 0 } };
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const { totalIncome } = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM incomes WHERE manager_id = ?`)
      .get(managerId);

    const { totalExpense } = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses WHERE manager_id = ?`)
      .get(managerId);

    const currentMonthDue = db
      .prepare(
        `SELECT COALESCE(SUM(d.due_amount), 0) AS totalDue, COALESCE(SUM(d.paid_amount), 0) AS totalPaid
         FROM dues d
         JOIN apartments a ON d.apartment_id = a.id
         WHERE a.manager_id = ? AND d.year = ? AND d.month = ?`,
      )
      .get(managerId, currentYear, currentMonth);

    const { totalOverdue } = db
      .prepare(
        `SELECT COALESCE(SUM(d.due_amount - d.paid_amount), 0) AS totalOverdue
         FROM dues d
         JOIN apartments a ON d.apartment_id = a.id
         WHERE a.manager_id = ? AND (d.year < ? OR (d.year = ? AND d.month < ?)) AND d.status != 'paid'`,
      )
      .get(managerId, currentYear, currentYear, currentMonth);

    const cash = Math.max(Number(totalIncome) - Number(totalExpense), 0);
    const currentDue = Number(currentMonthDue?.totalDue || 0);
    const currentPaid = Number(currentMonthDue?.totalPaid || 0);
    const collections = currentDue > 0 ? Math.min(Math.round((currentPaid / currentDue) * 100), 100) : 0;
    const delays = Math.round(Number(totalOverdue || 0));

    return { success: true, payload: { cash, collections, delays } };
  } catch (err) {
    console.error("Dashboard statistics could not be retrieved:", err);
    return { success: false, message: "Dashboard verileri alınamadı." };
  }
}

module.exports = { getStats };

const db = require("../../database/db");

function queryGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function getStats(managerId) {
  if (!managerId) {
    return { success: true, payload: { cash: 0, collections: 0, delays: 0 } };
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const incomeRow = await queryGet(
      `SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM incomes WHERE manager_id = ?`,
      [managerId],
    );

    const expenseRow = await queryGet(
      `SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses WHERE manager_id = ?`,
      [managerId],
    );

    // Current month
    const currentMonthDueRow = await queryGet(
      `SELECT COALESCE(SUM(d.due_amount), 0) AS totalDue, COALESCE(SUM(d.paid_amount), 0) AS totalPaid
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.manager_id = ? AND d.year = ? AND d.month = ?`,
      [managerId, currentYear, currentMonth],
    );

    // Previous months
    const overdueRow = await queryGet(
      `SELECT COALESCE(SUM(d.due_amount - d.paid_amount), 0) AS totalOverdue
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.manager_id = ? AND (d.year < ? OR (d.year = ? AND d.month < ?)) AND d.status != 'paid'`,
      [managerId, currentYear, currentYear, currentMonth],
    );

    const totalIncome = Number(incomeRow.totalIncome || 0);
    const totalExpense = Number(expenseRow.totalExpense || 0);
    const currentDue = Number(currentMonthDueRow?.totalDue || 0);
    const currentPaid = Number(currentMonthDueRow?.totalPaid || 0);
    const totalOverdue = Number(overdueRow?.totalOverdue || 0);

    const cash = Math.max(totalIncome - totalExpense, 0);
    const collections = currentDue > 0 ? Math.min(Math.round((currentPaid / currentDue) * 100), 100) : 0;
    const delays = Math.round(totalOverdue);

    return { success: true, payload: { cash, collections, delays } };
  } catch (err) {
    console.error("Dashboard statistics could not be retrieved:", err);
    return { success: false, message: "Dashboard verileri alınamadı." };
  }
}

module.exports = { getStats };

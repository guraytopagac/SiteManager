const db = require("../../database/db");

function queryGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function getStats(managerId) {
  if (!managerId) {
    return {
      success: true,
      payload: { cash: 0, collections: 0, delays: 0 },
    };
  }

  try {
    const incomeRow = await queryGet(
      `SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM incomes WHERE manager_id = ?`,
      [managerId],
    );

    const expenseRow = await queryGet(
      `SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses WHERE manager_id = ?`,
      [managerId],
    );

    const dueRow = await queryGet(
      `SELECT COALESCE(SUM(due_amount), 0) AS totalDue FROM apartments WHERE manager_id = ?`,
      [managerId],
    );

    const totalIncome = Number(incomeRow.totalIncome || 0);
    const totalExpense = Number(expenseRow.totalExpense || 0);
    const totalDue = Number(dueRow.totalDue || 0);

    const cash = Math.max(totalIncome - totalExpense, 0);
    const delays = Math.max(totalDue - totalIncome, 0);
    const collections = totalDue > 0 ? Math.min(Math.round((totalIncome / totalDue) * 100), 100) : 0;

    return {
      success: true,
      payload: { cash, collections, delays },
    };
  } catch (err) {
    console.error("Dashboard statistics could not be retrieved:", err);
    return { success: false, message: "Dashboard verileri alınamadı." };
  }
}

module.exports = { getStats };

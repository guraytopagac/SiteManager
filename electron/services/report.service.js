const db = require("../../database/db");

function getReportData(managerId, year, month) {
  try {
    const yearStr = String(year);
    const monthStr = String(month).padStart(2, "0");

    const incomes = db
      .prepare(
        `SELECT id, amount, date, description
         FROM incomes
         WHERE manager_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
         ORDER BY date ASC`,
      )
      .all(managerId, yearStr, monthStr);

    const expenses = db
      .prepare(
        `SELECT id, amount, date, description
         FROM expenses
         WHERE manager_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
         ORDER BY date ASC`,
      )
      .all(managerId, yearStr, monthStr);

    const dues = db
      .prepare(
        `SELECT a.apartment_no, a.floor, a.type, a.resident_name,
                d.due_amount, d.paid_amount, d.status
         FROM dues d
         JOIN apartments a ON d.apartment_id = a.id
         WHERE a.manager_id = ? AND d.year = ? AND d.month = ?
         ORDER BY a.apartment_no ASC`,
      )
      .all(managerId, year, month);

    const totalIncome = incomes.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpense = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalDue = dues.reduce((sum, r) => sum + Number(r.due_amount), 0);
    const totalPaid = dues.reduce((sum, r) => sum + Number(r.paid_amount), 0);

    return {
      success: true,
      data: { incomes, expenses, dues, totalIncome, totalExpense, totalDue, totalPaid },
    };
  } catch (err) {
    console.error("Report data error:", err);
    return { success: false, message: "Rapor verileri alınamadı." };
  }
}

module.exports = { getReportData };
